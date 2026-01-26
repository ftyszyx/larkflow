import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { articles, feishuSpaceSyncs, integrations, jobs } from "../drizzle/schema.ts";
import { JobQueue } from "../constants/jobs.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";
import { fail, ok } from "../utils/response.ts";

export const integrationSyncRoutes = new Hono<AppEnv>();

type SyncIntegrationBody = {
  doc_token?: string;
};

integrationSyncRoutes.post(
  "/integrations/:id/sync",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin", "member"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return fail(c, 400, "invalid id");

    const body = (await c.req.json().catch(() => null)) as SyncIntegrationBody | null;
    const docToken = body?.doc_token?.trim();
    if (!docToken) return fail(c, 400, "doc_token is required");

    const integration = await db
      .select({ id: integrations.id, workspaceId: integrations.workspaceId })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return fail(c, 404, "not found");

    const existing = await db
      .select()
      .from(feishuSpaceSyncs)
      .where(and(eq(feishuSpaceSyncs.integrationId, integrationId), eq(feishuSpaceSyncs.docToken, docToken)));

    if (existing.length > 0 && existing[0].status === "syncing") {
      return ok(c, { sync: existing[0], jobCreated: false });
    }

    const syncRows = await db
      .insert(feishuSpaceSyncs)
      .values({
        integrationId,
        docToken,
        status: "idle",
        lastSyncedAt: null,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: [feishuSpaceSyncs.integrationId, feishuSpaceSyncs.docToken],
        set: {
          status: "idle",
          lastSyncedAt: null,
          lastError: null,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    const jobKey = `${integrationId}:${docToken}`;
    const [existingJob] = await db
      .select({ id: jobs.id, queue: jobs.queue, scheduledAt: jobs.scheduledAt })
      .from(jobs)
      .where(and(eq(jobs.workspaceId, workspaceId), eq(jobs.queue, JobQueue.SyncFeishuSpace), eq(jobs.jobKey, jobKey)))
      .limit(1);
    if (existingJob) return fail(c, 409, "duplicate job", 409, { existing: existingJob });

    const jobRows = await db
      .insert(jobs)
      .values({
        workspaceId,
        jobKey,
        queue: JobQueue.SyncFeishuSpace,
        payload: {
          type: JobQueue.SyncFeishuSpace,
          integrationId,
          workspaceId,
          docToken,
        },
      })
      .returning({ id: jobs.id, queue: jobs.queue, scheduledAt: jobs.scheduledAt });

    return ok(c, { sync: syncRows[0], job: jobRows[0], jobCreated: true }, 201);
  },
);

integrationSyncRoutes.get(
  "/integrations/:id/sync",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return fail(c, 400, "invalid id");

    const docToken = (c.req.query("doc_token") ?? "").trim();
    if (!docToken) return fail(c, 400, "doc_token is required");

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return fail(c, 404, "not found");

    const rows = await db
      .select()
      .from(feishuSpaceSyncs)
      .where(and(eq(feishuSpaceSyncs.integrationId, integrationId), eq(feishuSpaceSyncs.docToken, docToken)));
    if (rows.length === 0) return fail(c, 404, "not found");
    return ok(c, rows[0]);
  },
);

integrationSyncRoutes.get(
  "/integrations/:id/syncs",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return fail(c, 400, "invalid id");

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return fail(c, 404, "not found");

    const data = await db.select().from(feishuSpaceSyncs).where(eq(feishuSpaceSyncs.integrationId, integrationId));
    return ok(c, data);
  },
);

integrationSyncRoutes.get(
  "/integrations/:id/articles/byDocToken",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return fail(c, 400, "invalid id");

    const docToken = (c.req.query("doc_token") ?? "").trim();
    if (!docToken) return fail(c, 400, "doc_token is required");

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return fail(c, 404, "not found");

    const rows = await db
      .select()
      .from(articles)
      .where(and(eq(articles.integrationId, integrationId), eq(articles.sourceDocToken, docToken)));
    if (rows.length === 0) return fail(c, 404, "not found");
    return ok(c, rows[0]);
  },
);

integrationSyncRoutes.post(
  "/integrations/:id/sync/reset",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return fail(c, 400, "invalid id");

    const body = (await c.req.json().catch(() => null)) as SyncIntegrationBody | null;
    const docToken = body?.doc_token?.trim();
    if (!docToken) return fail(c, 400, "doc_token is required");

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return fail(c, 404, "not found");

    const rows = await db
      .insert(feishuSpaceSyncs)
      .values({
        integrationId,
        docToken,
        status: "idle",
        lastSyncedAt: null,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: [feishuSpaceSyncs.integrationId, feishuSpaceSyncs.docToken],
        set: {
          status: "idle",
          lastSyncedAt: null,
          lastError: null,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return ok(c, rows[0]);
  },
);
