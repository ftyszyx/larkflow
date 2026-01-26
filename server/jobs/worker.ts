import { sql } from "drizzle-orm";
import { db } from "../db.ts";
import { jobs } from "../drizzle/schema.ts";
import { systemSettings } from "../drizzle/schema.ts";
import { JobQueue } from "../constants/jobs.ts";
import { handleSyncFeishuSpace } from "./handlers/sync_feishu_space.ts";
import { handlePublishArticle } from "./handlers/publish_article.ts";

type JobRow = {
  id: number;
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

const getInt = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

const loadWorkerRuntimeConfig = async (): Promise<WorkerRuntimeConfig> => {
  const workerId = Deno.env.get("WORKER_ID") ?? `worker-${crypto.randomUUID()}`;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    returning id, queue, payload, attempts, max_attempts
  `);

  return res.rows?.[0] ?? null;
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

const runWorkerLoop = async (workerId: string, pollMs: number, lockSeconds: number) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await claimNextJob(workerId, lockSeconds);
    if (!job) {
      await sleep(pollMs);
      continue;
    }

    try {
      await dispatchJob(job);
      await markJobDone(job.id);
    } catch {
      await markJobFailed(job.id, job.attempts);
    }
  }
};

export const runWorker = async () => {
  const cfg = await loadWorkerRuntimeConfig();
  const loops = Array.from({ length: cfg.concurrency }, (_, i) => {
    const suffix = cfg.concurrency === 1 ? "" : `-${i + 1}`;
    return runWorkerLoop(`${cfg.workerId}${suffix}`, cfg.pollMs, cfg.lockSeconds);
  });
  await Promise.all(loops);
};

if (import.meta.main) {
  await runWorker();
}
