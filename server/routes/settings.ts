import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { workspaceSettings } from "../drizzle/schema.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";
import { fail, ok } from "../utils/response.ts";

export const settingsRoutes = new Hono<AppEnv>();

export type WorkspaceOssSettingsValue = {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint?: string;
  publicBaseUrl?: string;
};

const OSS_KEY = "aliyun_oss";

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
};

const parseOssSettings = (value: unknown): WorkspaceOssSettingsValue | null => {
  if (!isObjectRecord(value)) return null;

  const region = normalizeString(value.region);
  const accessKeyId = normalizeString(value.accessKeyId);
  const accessKeySecret = normalizeString(value.accessKeySecret);
  const bucket = normalizeString(value.bucket);

  if (!region || !accessKeyId || !accessKeySecret || !bucket) return null;

  const endpoint = normalizeString(value.endpoint) ?? undefined;
  const publicBaseUrl = normalizeString(value.publicBaseUrl) ?? undefined;

  return { region, accessKeyId, accessKeySecret, bucket, endpoint, publicBaseUrl };
};

settingsRoutes.get(
  "/settings/oss",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;

    const rows = await db
      .select({ value: workspaceSettings.value })
      .from(workspaceSettings)
      .where(and(eq(workspaceSettings.workspaceId, workspaceId), eq(workspaceSettings.key, OSS_KEY)))
      .limit(1);

    const value = rows[0]?.value ?? null;
    const parsed = value ? parseOssSettings(value) : null;

    return ok(c, parsed);
  },
);

settingsRoutes.put(
  "/settings/oss",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;

    const body = (await c.req.json().catch(() => null)) as null | { value?: unknown };
    const parsed = parseOssSettings(body?.value);
    if (!parsed) return fail(c, 400, "invalid oss config");

    const inserted = await db
      .insert(workspaceSettings)
      .values({
        workspaceId,
        key: OSS_KEY,
        value: parsed,
      })
      .onConflictDoUpdate({
        target: [workspaceSettings.workspaceId, workspaceSettings.key],
        set: {
          value: parsed,
          updatedAt: sql`now()`,
        },
      })
      .returning({ value: workspaceSettings.value });

    const value = inserted[0]?.value ?? null;
    const normalized = value ? parseOssSettings(value) : null;
    return ok(c, normalized, 200);
  },
);
