import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { articles, feishuSpaceSyncs, integrations, jobs } from "../drizzle/schema.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireWorkspace, requireWorkspaceMember, requireRole } from "../middleware/workspace.ts";
import type { WorkspaceRole } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";

export const integrationRoutes = new Hono<AppEnv>();

type IntegrationRow = typeof integrations.$inferSelect;

type CreateIntegrationBody = {
  platformType?: number;
  feishuWorkspaceId?: string | null;
  name?: string;
  status?: string;
  config?: Record<string, unknown>;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  extra?: Record<string, unknown>;
};

type PatchIntegrationBody = {
  platformType?: number;
  feishuWorkspaceId?: string | null;
  name?: string;
  status?: string;
  config?: Record<string, unknown>;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  extra?: Record<string, unknown>;
};

type SyncIntegrationBody = {
  docToken?: string;
};

const serializeIntegration = (row: IntegrationRow, includeSecrets: boolean) => {
  const base = {
    id: row.id,
    workspaceId: row.workspaceId,
    platformType: row.platformType,
    feishuWorkspaceId: row.feishuWorkspaceId,
    name: row.name,
    status: row.status,
    config: row.config,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (!includeSecrets) return base;

  return {
    ...base,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    extra: row.extra,
  };
};

integrationRoutes.get(
  "/integrations",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const role = c.get("role") as WorkspaceRole;

    const rows = await db.select().from(integrations).where(eq(integrations.workspaceId, workspaceId));

    const includeSecrets = role === "owner" || role === "admin";
    const data = rows.map((r) => serializeIntegration(r, includeSecrets));

    return c.json({ data });
  },
);

integrationRoutes.post(
  "/integrations",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;

    const body = (await c.req.json().catch(() => null)) as CreateIntegrationBody | null;
    if (!body) return c.json({ message: "invalid json" }, 400);

    if (!Number.isFinite(body.platformType)) return c.json({ message: "platformType is required" }, 400);
    if (!body.name) return c.json({ message: "name is required" }, 400);

    const inserted = await db
      .insert(integrations)
      .values({
        workspaceId,
        platformType: body.platformType as number,
        feishuWorkspaceId: body.feishuWorkspaceId ?? null,
        name: body.name,
        status: body.status ?? "connected",
        config: body.config ?? {},
        accessToken: body.accessToken ?? null,
        refreshToken: body.refreshToken ?? null,
        expiresAt: body.expiresAt ?? null,
        extra: body.extra ?? {},
      })
      .returning();

    return c.json({ data: serializeIntegration(inserted[0], true) }, 201);
  },
);

integrationRoutes.patch(
  "/integrations/:id",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ message: "invalid id" }, 400);

    const body = (await c.req.json().catch(() => null)) as PatchIntegrationBody | null;
    if (!body) return c.json({ message: "invalid json" }, 400);

    const patch: Record<string, unknown> = {};
    if (body.platformType !== undefined) patch.platformType = body.platformType;
    if (body.feishuWorkspaceId !== undefined) patch.feishuWorkspaceId = body.feishuWorkspaceId;
    if (body.name !== undefined) patch.name = body.name;
    if (body.status !== undefined) patch.status = body.status;
    if (body.config !== undefined) patch.config = body.config;
    if (body.accessToken !== undefined) patch.accessToken = body.accessToken;
    if (body.refreshToken !== undefined) patch.refreshToken = body.refreshToken;
    if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt;
    if (body.extra !== undefined) patch.extra = body.extra;

    const updated = await db
      .update(integrations)
      .set(patch)
      .where(and(eq(integrations.id, id), eq(integrations.workspaceId, workspaceId)))
      .returning();

    if (updated.length === 0) return c.json({ message: "not found" }, 404);
    return c.json({ data: serializeIntegration(updated[0], true) });
  },
);

integrationRoutes.delete(
  "/integrations/:id",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ message: "invalid id" }, 400);

    const deleted = await db
      .delete(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.workspaceId, workspaceId)))
      .returning({ id: integrations.id });

    if (deleted.length === 0) return c.json({ message: "not found" }, 404);
    return c.json({ data: deleted[0] });
  },
);

integrationRoutes.post(
  "/integrations/:id/sync",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return c.json({ message: "invalid id" }, 400);

    const body = (await c.req.json().catch(() => null)) as SyncIntegrationBody | null;
    const docToken = body?.docToken?.trim();
    if (!docToken) return c.json({ message: "docToken is required" }, 400);

    const integration = await db
      .select({ id: integrations.id, workspaceId: integrations.workspaceId })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return c.json({ message: "not found" }, 404);

    const existing = await db
      .select()
      .from(feishuSpaceSyncs)
      .where(and(eq(feishuSpaceSyncs.integrationId, integrationId), eq(feishuSpaceSyncs.docToken, docToken)));

    if (existing.length > 0 && existing[0].status === "syncing") {
      return c.json({ data: { sync: existing[0], jobCreated: false } });
    }

    const syncRows = await db
      .insert(feishuSpaceSyncs)
      .values({
        integrationId,
        docToken,
        status: "idle",
      })
      .onConflictDoUpdate({
        target: [feishuSpaceSyncs.integrationId, feishuSpaceSyncs.docToken],
        set: {
          status: "idle",
          lastError: null,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    const jobRows = await db
      .insert(jobs)
      .values({
        workspaceId,
        queue: "sync_feishu_space",
        payload: {
          type: "sync_feishu_space",
          integrationId,
          workspaceId,
          docToken,
        },
      })
      .returning({ id: jobs.id, queue: jobs.queue, scheduledAt: jobs.scheduledAt });

    return c.json({ data: { sync: syncRows[0], job: jobRows[0], jobCreated: true } }, 201);
  },
);

integrationRoutes.get(
  "/integrations/:id/sync",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return c.json({ message: "invalid id" }, 400);

    const docToken = (c.req.query("docToken") ?? "").trim();
    if (!docToken) return c.json({ message: "docToken is required" }, 400);

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return c.json({ message: "not found" }, 404);

    const rows = await db
      .select()
      .from(feishuSpaceSyncs)
      .where(and(eq(feishuSpaceSyncs.integrationId, integrationId), eq(feishuSpaceSyncs.docToken, docToken)));
    if (rows.length === 0) return c.json({ message: "not found" }, 404);
    return c.json({ data: rows[0] });
  },
);

integrationRoutes.get(
  "/integrations/:id/syncs",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return c.json({ message: "invalid id" }, 400);

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return c.json({ message: "not found" }, 404);

    const data = await db.select().from(feishuSpaceSyncs).where(eq(feishuSpaceSyncs.integrationId, integrationId));
    return c.json({ data });
  },
);

integrationRoutes.get(
  "/integrations/:id/articles/byDocToken",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return c.json({ message: "invalid id" }, 400);

    const docToken = (c.req.query("docToken") ?? "").trim();
    if (!docToken) return c.json({ message: "docToken is required" }, 400);

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return c.json({ message: "not found" }, 404);

    const rows = await db
      .select()
      .from(articles)
      .where(and(eq(articles.integrationId, integrationId), eq(articles.sourceDocToken, docToken)));
    if (rows.length === 0) return c.json({ message: "not found" }, 404);
    return c.json({ data: rows[0] });
  },
);

integrationRoutes.post(
  "/integrations/:id/sync/reset",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const integrationId = Number(c.req.param("id"));
    if (!Number.isFinite(integrationId)) return c.json({ message: "invalid id" }, 400);

    const body = (await c.req.json().catch(() => null)) as SyncIntegrationBody | null;
    const docToken = body?.docToken?.trim();
    if (!docToken) return c.json({ message: "docToken is required" }, 400);

    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.workspaceId, workspaceId)));
    if (integration.length === 0) return c.json({ message: "not found" }, 404);

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

    return c.json({ data: rows[0] });
  },
);
