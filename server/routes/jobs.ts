import { Hono, type MiddlewareHandler } from "hono";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { jobs } from "../drizzle/schema.ts";
import { requireApiKey, requireUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";
import { verifyUserJwt } from "../utils/jwt.ts";
import { users } from "../drizzle/schema.ts";
import { fail, ok, okList } from "../utils/response.ts";

type SseWriter = WritableStreamDefaultWriter<Uint8Array>;
const sseClients = new Map<number, Set<SseWriter>>();

const publishJobEvent = (workspaceId: number, payload: Record<string, unknown>) => {
  const writers = sseClients.get(workspaceId);
  if (!writers || writers.size === 0) return;
  const msg = `event: job\ndata: ${JSON.stringify(payload)}\n\n`;
  const bytes = new TextEncoder().encode(msg);
  for (const w of writers) {
    w.write(bytes).catch(() => {
      // ignore; cleanup happens on close
    });
  }
};

const requireUserFromQueryToken: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = (c.req.query("token") ?? "").trim();
  if (!token) return c.json({ message: "missing token" }, 401);

  let claims: { uid: number; email: string; isPlatformAdmin: boolean };
  try {
    claims = await verifyUserJwt(token);
  } catch {
    return c.json({ message: "invalid token" }, 401);
  }

  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, claims.uid))
    .limit(1);
  if (!row) return c.json({ message: "unauthorized" }, 401);

  c.set("user", row);
  await next();
};

export const jobRoutes = new Hono<AppEnv>();

jobRoutes.get(
  "/jobs/stream",
  // EventSource cannot set Authorization header; use query token.
  requireUserFromQueryToken,
  requireWorkspace,
  requireWorkspaceMember,
  (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    let set = sseClients.get(workspaceId);
    if (!set) {
      set = new Set<SseWriter>();
      sseClients.set(workspaceId, set);
    }
    set.add(writer);

    const ping = setInterval(() => {
      writer.write(new TextEncoder().encode(`: ping\n\n`)).catch(() => {});
    }, 20000);

    // initial event
    writer.write(new TextEncoder().encode(`: connected\n\n`)).catch(() => {});

    c.req.raw.signal.addEventListener(
      "abort",
      () => {
        clearInterval(ping);
        set?.delete(writer);
        if (set && set.size === 0) sseClients.delete(workspaceId);
        writer.close().catch(() => {});
      },
      { once: true },
    );

    return new Response(readable, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  },
);

jobRoutes.post("/jobs/webhook", requireApiKey, async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | { workspace_id?: number; event?: string; job?: Record<string, unknown> };
  if (!body) return fail(c, 400, "invalid json");

  const workspaceId = Number(body.workspace_id);
  if (!Number.isFinite(workspaceId)) return fail(c, 400, "workspace_id is required");

  publishJobEvent(workspaceId, {
    type: "job",
    event: String(body.event ?? "update"),
    job: body.job ?? {},
  });

  return ok(c, { ok: true });
});

jobRoutes.get("/jobs", requireUser, requireWorkspace, requireWorkspaceMember, async (c) => {
  const workspaceId = c.get("workspaceId") as number;

  const queue = (c.req.query("queue") ?? "").trim();
  const page = Math.max(Number(c.req.query("page") ?? 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(c.req.query("page_size") ?? 50) || 50, 1), 200);
  const offset = (page - 1) * pageSize;

  const where = queue ? and(eq(jobs.workspaceId, workspaceId), eq(jobs.queue, queue)) : eq(jobs.workspaceId, workspaceId);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(jobs)
    .where(where);
  const total = Number(countRow?.total ?? 0);

  const data = await db.select().from(jobs).where(where).orderBy(asc(jobs.scheduledAt)).limit(pageSize).offset(offset);

  return okList(c, data, total);
});

jobRoutes.get("/jobs/:id", requireUser, requireWorkspace, requireWorkspaceMember, async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.workspaceId, workspaceId)))
    .limit(1);

  if (!row) return fail(c, 404, "not found");
  return ok(c, row);
});

jobRoutes.post("/jobs/:id/cancel", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin"]), async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

  const deleted = await db
    .delete(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.workspaceId, workspaceId)))
    .returning({ id: jobs.id });

  if (deleted.length === 0) return fail(c, 404, "not found");
  publishJobEvent(workspaceId, { type: "job", event: "canceled", job: { id } });
  return ok(c, deleted[0]);
});

jobRoutes.post("/jobs/:id/retry", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin"]), async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

  const updated = await db
    .update(jobs)
    .set({
      attempts: 0,
      lockedBy: null,
      lockedUntil: null,
      scheduledAt: new Date().toISOString(),
    })
    .where(and(eq(jobs.id, id), eq(jobs.workspaceId, workspaceId)))
    .returning({ id: jobs.id, scheduledAt: jobs.scheduledAt });

  if (updated.length === 0) return fail(c, 404, "not found");
  publishJobEvent(workspaceId, { type: "job", event: "retry", job: { id } });
  return ok(c, updated[0]);
});
