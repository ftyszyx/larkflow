import { sql } from "drizzle-orm";
import { db } from "../db.ts";
import { jobs } from "../drizzle/schema.ts";
import { systemSettings } from "../drizzle/schema.ts";
import { JobQueue } from "../constants/jobs.ts";
import { handleSyncFeishuSpace } from "./handlers/sync_feishu_space.ts";
import { handlePublishArticle } from "./handlers/publish_article.ts";

type JobRow = {
  id: number;
  workspaceId: number | null;
  queue: JobQueue;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type WorkerRuntimeConfig = {
  workerId: string;
  concurrency: number;
  pollMs: number;
  lockSeconds: number;
};

const WORKER_SETTINGS_KEY = "worker";
const CONFIG_RELOAD_MS = 30_000;

const getInt = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

const loadWorkerRuntimeConfig = async (workerId: string): Promise<WorkerRuntimeConfig> => {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(sql`${systemSettings.key} = ${WORKER_SETTINGS_KEY}`)
    .limit(1);

  const value = row?.value;
  const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  const concurrency = Math.max(1, getInt(obj.concurrency, 1));
  const pollMs = Math.max(50, getInt(obj.pollMs, 1000));
  const lockSeconds = Math.max(1, getInt(obj.lockSeconds, 30));

  return { workerId, concurrency, pollMs, lockSeconds };
};

const sleepAbortable = (ms: number, signal: AbortSignal) => {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
};

const claimNextJob = async (workerId: string, lockSeconds: number): Promise<JobRow | null> => {
  const res = await db.execute<JobRow>(sql`
    update jobs
    set locked_by = ${workerId},
        locked_until = now() + (${lockSeconds} || ' seconds')::interval,
        updated_at = now()
    where id = (
      select id
      from jobs
      where scheduled_at <= now()
        and (locked_until is null or locked_until < now())
        and attempts < max_attempts
      order by scheduled_at asc
      limit 1
      for update skip locked
    )
    returning id, workspace_id as "workspaceId", queue, payload, attempts, max_attempts
  `);

  return res.rows?.[0] ?? null;
};

const emitJobEvent = async (job: JobRow, event: string) => {
  const apiKey = (Deno.env.get("API_KEY") ?? "").trim();
  if (!apiKey) return;
  if (!job.workspaceId) return;

  const baseUrl = (Deno.env.get("BASE_URL") ?? "http://127.0.0.1:8000").replace(/\/$/, "");

  try {
    await fetch(`${baseUrl}/api/w/${job.workspaceId}/jobs/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        workspace_id: job.workspaceId,
        event,
        job: {
          id: job.id,
          queue: job.queue,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
        },
      }),
    });
  } catch {
    // ignore
  }
};

const markJobDone = async (jobId: number) => {
  await db.delete(jobs).where(sql`${jobs.id} = ${jobId}`);
};

const markJobFailed = async (jobId: number, attempts: number) => {
  await db
    .update(jobs)
    .set({
      attempts: attempts + 1,
      lockedBy: null,
      lockedUntil: null,
      scheduledAt: sql`now() + (${Math.min(60, Math.max(1, attempts + 1))} || ' seconds')::interval`,
      updatedAt: sql`now()`,
    })
    .where(sql`${jobs.id} = ${jobId}`);
};

const dispatchJob = async (job: JobRow) => {
  const payload = job.payload;

  if (job.queue === JobQueue.SyncFeishuSpace || payload.type === JobQueue.SyncFeishuSpace) {
    await handleSyncFeishuSpace(payload as unknown as Parameters<typeof handleSyncFeishuSpace>[0]);
    return;
  }

  if (job.queue === JobQueue.PublishArticle || payload.type === JobQueue.PublishArticle) {
    await handlePublishArticle(payload as unknown as Parameters<typeof handlePublishArticle>[0]);
    return;
  }

  throw new Error(`unknown job queue: ${job.queue}`);
};

const runWorkerLoop = async (opts: { workerId: string; getPollMs: () => number; getLockSeconds: () => number; signal: AbortSignal }) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (opts.signal.aborted) return;

    const job = await claimNextJob(opts.workerId, opts.getLockSeconds());
    if (!job) {
      await sleepAbortable(opts.getPollMs(), opts.signal);
      continue;
    }

    await emitJobEvent(job, "claimed");

    try {
      await dispatchJob(job);
      await markJobDone(job.id);
      await emitJobEvent(job, "done");
    } catch {
      await markJobFailed(job.id, job.attempts);
      await emitJobEvent(job, "failed");
    }
  }
};

export const runWorker = async () => {
  const baseWorkerId = Deno.env.get("WORKER_ID") ?? `worker-${crypto.randomUUID()}`;
  let cfg = await loadWorkerRuntimeConfig(baseWorkerId);

  const getPollMs = () => cfg.pollMs;
  const getLockSeconds = () => cfg.lockSeconds;

  const controllers = new Map<string, AbortController>();
  const loopPromises = new Map<string, Promise<void>>();

  const startLoop = (idx: number) => {
    const suffix = cfg.concurrency === 1 ? "" : `-${idx}`;
    const id = `${cfg.workerId}${suffix}`;
    if (controllers.has(id)) return;
    const ac = new AbortController();
    controllers.set(id, ac);
    const p = runWorkerLoop({ workerId: id, getPollMs, getLockSeconds, signal: ac.signal }).finally(() => {
      controllers.delete(id);
      loopPromises.delete(id);
    });
    loopPromises.set(id, p);
  };

  const stopExtraLoops = (desired: number) => {
    // stop loops with highest suffix first
    const ids = Array.from(controllers.keys()).sort().reverse();
    while (ids.length > desired) {
      const id = ids.shift();
      if (!id) break;
      controllers.get(id)?.abort();
    }
  };

  const reconcile = () => {
    const desired = Math.max(1, cfg.concurrency);
    // Ensure IDs are stable across reloads by using numeric suffixes 1..desired
    for (let i = 1; i <= desired; i++) startLoop(i);
    stopExtraLoops(desired);
  };

  reconcile();

  const reloadTimer = setInterval(async () => {
    try {
      const next = await loadWorkerRuntimeConfig(baseWorkerId);
      cfg = next;
      reconcile();
    } catch {
      // ignore reload failures
    }
  }, CONFIG_RELOAD_MS);

  // Block forever until all loops end (normally never). If all loops are aborted, keep process alive.
  try {
    await Promise.race([Promise.all(loopPromises.values())]);
  } finally {
    clearInterval(reloadTimer);
  }
};

if (import.meta.main) {
  await runWorker();
}
