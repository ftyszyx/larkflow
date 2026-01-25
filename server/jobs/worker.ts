import { sql } from "drizzle-orm";
import { db } from "../db.ts";
import { jobs } from "../drizzle/schema.ts";
import { handleSyncFeishuSpace } from "./handlers/sync_feishu_space.ts";
import { handlePublishArticle } from "./handlers/publish_article.ts";

type JobRow = {
  id: number;
  queue: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

const getEnvInt = (name: string, fallback: number) => {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const WORKER_ID = Deno.env.get("WORKER_ID") ?? `worker-${crypto.randomUUID()}`;
const POLL_MS = getEnvInt("WORKER_POLL_MS", 1000);
const LOCK_SECONDS = getEnvInt("WORKER_LOCK_SECONDS", 30);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const claimNextJob = async (): Promise<JobRow | null> => {
  const res = await db.execute<JobRow>(sql`
    update jobs
    set locked_by = ${WORKER_ID},
        locked_until = now() + (${LOCK_SECONDS} || ' seconds')::interval,
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

  if (job.queue === "sync_feishu_space" || payload.type === "sync_feishu_space") {
    await handleSyncFeishuSpace(payload as unknown as Parameters<typeof handleSyncFeishuSpace>[0]);
    return;
  }

  if (job.queue === "publish_article" || payload.type === "publish_article") {
    await handlePublishArticle(payload as unknown as Parameters<typeof handlePublishArticle>[0]);
    return;
  }

  throw new Error(`unknown job queue: ${job.queue}`);
};

export const runWorker = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await claimNextJob();
    if (!job) {
      await sleep(POLL_MS);
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

if (import.meta.main) {
  await runWorker();
}
