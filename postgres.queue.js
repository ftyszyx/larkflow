// queue.js
class PostgresQueue {
  constructor(pool) {
    this.pool = pool;
  }

  async enqueue(queue, payload, scheduledAt = new Date()) {
    await this.pool.query(
      'INSERT INTO jobs (queue, payload, scheduled_at) VALUES ($1, $2, $3)',
      [queue, payload, scheduledAt]
    );
  }

  async dequeue(queue, { workerId = null, visibilityTimeoutSeconds = 300 } = {}) {
    const result = await this.pool.query(
      `WITH next_job AS (
        SELECT id FROM jobs
        WHERE queue = $1
          AND attempts < max_attempts
          AND scheduled_at <= NOW()
          AND (locked_until IS NULL OR locked_until <= NOW())
        ORDER BY scheduled_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE jobs
      SET attempts = attempts + 1,
          locked_by = $2,
          locked_until = NOW() + ($3 || ' seconds')::interval,
          updated_at = NOW()
      FROM next_job
      WHERE jobs.id = next_job.id
      RETURNING jobs.*`,
      [queue, workerId, visibilityTimeoutSeconds]
    );

    return result.rows[0] ?? null;
  }

  async complete(jobId) {
    await this.pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);
  }

  async fail(jobId, error, { retryDelaySeconds = 60 } = {}) {
    await this.pool.query(
      `UPDATE jobs
       SET locked_until = NULL,
           locked_by = NULL,
           scheduled_at = NOW() + ($3 || ' seconds')::interval,
           payload = payload || jsonb_build_object('error', $2),
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, error?.message ?? String(error), retryDelaySeconds]
    );
  }
}

module.exports = PostgresQueue;