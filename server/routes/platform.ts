import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { users, workspaceMembers, workspaces } from "../drizzle/schema.ts";
import { requirePlatformAdmin, requireUser } from "../middleware/auth.ts";
import type { WorkspaceRole } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";
import { hashPassword } from "../utils/password.ts";

export const platformRoutes = new Hono<AppEnv>();

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

  return c.json({ data });
});

platformRoutes.post("/platform/workspaces", requireUser, requirePlatformAdmin, async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | { name?: string };
  if (!body?.name) return c.json({ message: "name is required" }, 400);

  const created = await db.insert(workspaces).values({ name: body.name }).returning({
    id: workspaces.id,
    name: workspaces.name,
  });

  return c.json({ data: created[0] }, 201);
});

platformRoutes.post("/platform/workspaces/:workspaceId/members", requireUser, requirePlatformAdmin, async (c) => {
  const workspaceId = Number(c.req.param("workspaceId"));
  if (!Number.isFinite(workspaceId)) return c.json({ message: "invalid workspaceId" }, 400);

  const body = (await c.req.json().catch(() => null)) as null | {
    email?: string;
    name?: string | null;
    role?: WorkspaceRole;
    password?: string;
  };
  if (!body?.email) return c.json({ message: "email is required" }, 400);
  if (!body?.role) return c.json({ message: "role is required" }, 400);

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

  return c.json({ data: inserted[0] }, 201);
});

platformRoutes.post("/platform/users/:userId/platform-admin", requireUser, requirePlatformAdmin, async (c) => {
  const userId = Number(c.req.param("userId"));
  if (!Number.isFinite(userId)) return c.json({ message: "invalid userId" }, 400);

  const body = (await c.req.json().catch(() => null)) as null | { isPlatformAdmin?: boolean };
  if (typeof body?.isPlatformAdmin !== "boolean") return c.json({ message: "isPlatformAdmin is required" }, 400);

  const updated = await db
    .update(users)
    .set({ isPlatformAdmin: body.isPlatformAdmin, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email, isPlatformAdmin: users.isPlatformAdmin });

  if (updated.length === 0) return c.json({ message: "not found" }, 404);
  return c.json({ data: updated[0] });
});

platformRoutes.get("/platform/workspaces/:workspaceId/members", requireUser, requirePlatformAdmin, async (c) => {
  const workspaceId = Number(c.req.param("workspaceId"));
  if (!Number.isFinite(workspaceId)) return c.json({ message: "invalid workspaceId" }, 400);

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

  return c.json({ data });
});
