import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { integrations } from "../drizzle/schema.ts";
import { PlatformType, type IntegrationConfig, isObjectRecord, isPlatformType } from "../constants/platform.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireWorkspace, requireWorkspaceMember, requireRole } from "../middleware/workspace.ts";
import type { WorkspaceRole } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";
import { fail, ok } from "../utils/response.ts";

export const integrationRoutes = new Hono<AppEnv>();

type IntegrationRow = typeof integrations.$inferSelect;

type CreateIntegrationBody = {
  platform_type?: number | string;
  name?: string;
  status?: string;
  config?: IntegrationConfig;
};

type PatchIntegrationBody = {
  platform_type?: number | string;
  name?: string;
  status?: string;
  config?: IntegrationConfig;
};

const normalizeIntegrationStatus = (value: unknown) => {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "enable" || v === "disabled") return v;
  return null;
};

const parsePlatformType = (value: unknown): PlatformType | null => {
  if (typeof value === "number") {
    return isPlatformType(value) ? (value as PlatformType) : null;
  }

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (!v) return null;
    if (v === "feishu" || v === "lark") return PlatformType.Feishu;
    if (v === "wechat_mp" || v === "wechat" || v === "mp") return PlatformType.WechatMp;

    const n = Number(v);
    if (Number.isFinite(n) && isPlatformType(n)) return n as PlatformType;
  }

  return null;
};

const normalizeIntegrationConfig = (platformType: PlatformType, cfg: IntegrationConfig | undefined) => {
  const config: IntegrationConfig = { ...(cfg ?? {}) };

  if (!config.baseUrl) {
    config.baseUrl = platformType === PlatformType.Feishu ? "https://open.feishu.cn" : "https://api.weixin.qq.com";
  }

  if (!config.appId) throw new Error("config.appId is required");
  if (!config.appSecret) throw new Error("config.appSecret is required");

  if (platformType === PlatformType.Feishu) {
    const wsid = (config as Record<string, unknown>).workspaceId;
    if (typeof wsid !== "string" || !wsid.trim()) {
      throw new Error("config.workspaceId is required for feishu");
    }
    (config as Record<string, unknown>).workspaceId = wsid.trim();
  }

  return config;
};

const redactConfigForViewer = (cfg: unknown): Record<string, unknown> => {
  const raw = isObjectRecord(cfg) ? cfg : {};
  const { appSecret: _appSecret, ...rest } = raw;
  return rest;
};

const serializeIntegration = (row: IntegrationRow, includeSecrets: boolean) => {
  const base = {
    id: row.id,
    workspaceId: row.workspaceId,
    platformType: row.platformType,
    name: row.name,
    status: row.status,
    config: includeSecrets ? row.config : redactConfigForViewer(row.config),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  return base;
};

integrationRoutes.get("/integrations", requireUser, requireWorkspace, requireWorkspaceMember, async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const role = c.get("role") as WorkspaceRole;

  const rows = await db.select().from(integrations).where(eq(integrations.workspaceId, workspaceId));

  const includeSecrets = role === "owner" || role === "admin";
  const data = rows.map((r) => serializeIntegration(r, includeSecrets));

  return ok(c, data);
});

integrationRoutes.post("/integrations", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin"]), async (c) => {
  const workspaceId = c.get("workspaceId") as number;

  const body = (await c.req.json().catch(() => null)) as CreateIntegrationBody | null;
  if (!body) return fail(c, 400, "invalid json");

  const platformType = parsePlatformType(body.platform_type);
  if (!platformType) return fail(c, 400, "platform_type is required");
  if (!body.name) return fail(c, 400, "name is required");

  let config: IntegrationConfig;
  try {
    config = normalizeIntegrationConfig(platformType, body.config);
  } catch (e) {
    return fail(c, 400, e instanceof Error ? e.message : "invalid config");
  }

  const inserted = await db
    .insert(integrations)
    .values({
      workspaceId,
      platformType,
      name: body.name,
      status: normalizeIntegrationStatus(body.status) ?? "enable",
      config,
    })
    .returning();

  return ok(c, serializeIntegration(inserted[0], true), 201);
});

integrationRoutes.patch("/integrations/:id", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin"]), async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

  const body = (await c.req.json().catch(() => null)) as PatchIntegrationBody | null;
  if (!body) return fail(c, 400, "invalid json");

  const patch: Record<string, unknown> = {};
  let nextPlatformType: PlatformType | null = null;
  if (body.platform_type !== undefined) {
    nextPlatformType = parsePlatformType(body.platform_type);
    if (!nextPlatformType) return fail(c, 400, "invalid platform_type");
    patch.platformType = nextPlatformType;
  }
  if (body.name !== undefined) patch.name = body.name;
  if (body.status !== undefined) {
    const status = normalizeIntegrationStatus(body.status);
    if (!status) return fail(c, 400, "invalid status");
    patch.status = status;
  }
  if (body.config !== undefined) {
    const [current] = await db
      .select({ platformType: integrations.platformType })
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.workspaceId, workspaceId)))
      .limit(1);
    if (!current) return fail(c, 404, "not found");

    const pt = nextPlatformType ?? (current.platformType as PlatformType);

    try {
      patch.config = normalizeIntegrationConfig(pt, body.config);
    } catch (e) {
      return fail(c, 400, e instanceof Error ? e.message : "invalid config");
    }
  }
  const updated = await db
    .update(integrations)
    .set(patch)
    .where(and(eq(integrations.id, id), eq(integrations.workspaceId, workspaceId)))
    .returning();

  if (updated.length === 0) return fail(c, 404, "not found");
  return ok(c, serializeIntegration(updated[0], true));
});

integrationRoutes.delete("/integrations/:id", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin"]), async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

  const deleted = await db
    .delete(integrations)
    .where(and(eq(integrations.id, id), eq(integrations.workspaceId, workspaceId)))
    .returning({ id: integrations.id });

  if (deleted.length === 0) return fail(c, 404, "not found");
  return ok(c, deleted[0]);
});
