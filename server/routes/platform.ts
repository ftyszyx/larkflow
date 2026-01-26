import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { systemSettings, users, workspaceMembers, workspaces } from "../drizzle/schema.ts";
import { requirePlatformAdmin, requireUser } from "../middleware/auth.ts";
import type { WorkspaceRole } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";
import { hashPassword } from "../utils/password.ts";
import { fail, ok } from "../utils/response.ts";

export const platformRoutes = new Hono<AppEnv>();

type WorkerSettingsValue = {
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

const parseWorkerSettings = (value: unknown): WorkerSettingsValue | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const concurrency = Math.max(1, getInt(obj.concurrency, 1));
  const pollMs = Math.max(50, getInt(obj.pollMs, 1000));
  const lockSeconds = Math.max(1, getInt(obj.lockSeconds, 30));
  return { concurrency, pollMs, lockSeconds };
};

platformRoutes.get("/platform/settings/worker", requireUser, requirePlatformAdmin, async (c) => {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, WORKER_SETTINGS_KEY))
    .limit(1);

  const parsed = row?.value ? parseWorkerSettings(row.value) : null;
  return ok(c, parsed);
});

platformRoutes.put("/platform/settings/worker", requireUser, requirePlatformAdmin, async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | { value?: unknown };
  const parsed = parseWorkerSettings(body?.value);
  if (!parsed) return fail(c, 400, "invalid worker settings");

  const inserted = await db
    .insert(systemSettings)
    .values({ key: WORKER_SETTINGS_KEY, value: parsed })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: parsed,
        updatedAt: sql`now()`,
      },
    })
    .returning({ value: systemSettings.value });

  const normalized = inserted[0]?.value ? parseWorkerSettings(inserted[0].value) : null;
  return ok(c, normalized, 200);
});

platformRoutes.get("/platform/workspaces", requireUser, requirePlatformAdmin, async (c) => {
  const data = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .orderBy(desc(workspaces.updatedAt));

  return ok(c, data);
});

platformRoutes.post("/platform/workspaces", requireUser, requirePlatformAdmin, async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | { name?: string };
  if (!body?.name) return fail(c, 400, "name is required");

  const created = await db.insert(workspaces).values({ name: body.name }).returning({
    id: workspaces.id,
    name: workspaces.name,
  });

  return ok(c, created[0], 201);
});

platformRoutes.post("/platform/workspaces/:workspaceId/members", requireUser, requirePlatformAdmin, async (c) => {
  const workspaceId = Number(c.req.param("workspaceId"));
  if (!Number.isFinite(workspaceId)) return fail(c, 400, "invalid workspaceId");

  const body = (await c.req.json().catch(() => null)) as null | {
    email?: string;
    name?: string | null;
    role?: WorkspaceRole;
    password?: string;
  };
  if (!body?.email) return fail(c, 400, "email is required");
  if (!body?.role) return fail(c, 400, "role is required");

  const email = body.email.trim().toLowerCase();
  const passwordHash = body.password ? await hashPassword(body.password) : null;

  const insertedUsers = await db
    .insert(users)
    .values({ email, name: body.name ?? null, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: body.name ?? null,
        passwordHash: passwordHash ?? sql`${users.passwordHash}`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: users.id });

  const userId = insertedUsers[0].id;

  const inserted = await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role: body.role })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: {
        role: body.role,
      },
    })
    .returning();

  return ok(c, inserted[0], 201);
});

platformRoutes.patch("/platform/users/:userId", requireUser, requirePlatformAdmin, async (c) => {
  const userId = Number(c.req.param("userId"));
  if (!Number.isFinite(userId)) return fail(c, 400, "invalid userId");

  const body = (await c.req.json().catch(() => null)) as null | { is_platform_admin?: boolean };
  if (typeof body?.is_platform_admin !== "boolean") return fail(c, 400, "is_platform_admin is required");

  const updated = await db
    .update(users)
    .set({ isPlatformAdmin: body.is_platform_admin, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning({ id: users.id, isPlatformAdmin: users.isPlatformAdmin });

  if (updated.length === 0) return fail(c, 404, "not found");
  return ok(c, updated[0]);
});

platformRoutes.get("/platform/workspaces/:workspaceId/members", requireUser, requirePlatformAdmin, async (c) => {
  const workspaceId = Number(c.req.param("workspaceId"));
  if (!Number.isFinite(workspaceId)) return fail(c, 400, "invalid workspaceId");

  const data = await db
    .select({
      userId: workspaceMembers.userId,
      email: users.email,
      name: users.name,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(workspaceMembers.createdAt));

  return ok(c, data);
});
