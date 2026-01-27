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
const CONFIG_RELOAD_MS = 30_000; // 30 seconds reload config

const getInt = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

//加载配置
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

//休眠
const sleepAbortable = (ms: number, signal: AbortSignal) => {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    //休眠固定时间
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    //监听取消
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
};

//获取任务
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

//触发webhook
const emitJobEvent = async (job: JobRow, event: string) => {
  if (!job.workspaceId) return;

  const baseUrl = (Deno.env.get("BASE_URL") ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const apiKey = (Deno.env.get("API_KEY") ?? "").trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  try {
    await fetch(`${baseUrl}/api/w/${job.workspaceId}/jobs/webhook`, {
      method: "POST",
      headers,
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

//完成任务
const markJobDone = async (jobId: number) => {
  await db.delete(jobs).where(sql`${jobs.id} = ${jobId}`);
};

//失败任务
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

//处理任务
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
  while (true) {
    if (opts.signal.aborted) return;
    const job = await claimNextJob(opts.workerId, opts.getLockSeconds());
    if (!job) {
      await sleepAbortable(opts.getPollMs(), opts.signal);
      continue;
    }
    console.log(`[worker] claimed job id=${job.id} queue=${job.queue} by=${opts.workerId}`);
    await emitJobEvent(job, "claimed");
    try {
      await dispatchJob(job);
      await markJobDone(job.id);
      await emitJobEvent(job, "done");
      console.log(`[worker] done job id=${job.id} queue=${job.queue}`);
    } catch (e) {
      await markJobFailed(job.id, job.attempts);
      await emitJobEvent(job, "failed");
      console.error(`[worker] failed job id=${job.id} queue=${job.queue}`, e);
    }
  }
};

export const runWorker = async () => {
  const baseWorkerId = Deno.env.get("WORKER_ID") ?? `worker-${crypto.randomUUID()}`;
  let cfg = await loadWorkerRuntimeConfig(baseWorkerId);
  console.log(
    `[worker] start id=${cfg.workerId} concurrency=${cfg.concurrency} pollMs=${cfg.pollMs} lockSeconds=${cfg.lockSeconds} reloadMs=${CONFIG_RELOAD_MS}`,
  );
  const getPollMs = () => cfg.pollMs;
  const getLockSeconds = () => cfg.lockSeconds;
  const controllers = new Map<string, AbortController>();//保存所有abort
  const loopPromises = new Map<string, Promise<void>>(); //保存所有任务
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
    const ids = Array.from(controllers.keys()).sort().reverse();
    while (ids.length > desired) {
      const id = ids.shift();
      if (!id) break;
      controllers.get(id)?.abort();
    }
  };

  const reconcile = () => {
    const desired = Math.max(1, cfg.concurrency);
    for (let i = 1; i <= desired; i++) startLoop(i);
    stopExtraLoops(desired);
  };

  reconcile();
  const reloadTimer = setInterval(async () => {
    try {
      const next = await loadWorkerRuntimeConfig(baseWorkerId);
      const changed = next.concurrency !== cfg.concurrency || next.pollMs !== cfg.pollMs || next.lockSeconds !== cfg.lockSeconds || next.workerId !== cfg.workerId;
      cfg = next;
      reconcile();
      if (changed) {
        console.log(`[worker] reload id=${cfg.workerId} concurrency=${cfg.concurrency} pollMs=${cfg.pollMs} lockSeconds=${cfg.lockSeconds}`);
      }
    } catch {
      // ignore reload failures
    }
  }, CONFIG_RELOAD_MS);

  try {
    await Promise.all(loopPromises.values());
  } finally {
    clearInterval(reloadTimer);
  }
};

if (import.meta.main) {
  await runWorker();
}
