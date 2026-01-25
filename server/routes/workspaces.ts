import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { and } from "drizzle-orm";
import { db } from "../db.ts";
import { users, workspaceMembers, workspaces } from "../drizzle/schema.ts";
import { requireUser } from "../middleware/auth.ts";
import type { AuthedUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import type { WorkspaceRole } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";

export const workspaceRoutes = new Hono<AppEnv>();

workspaceRoutes.get("/workspaces", requireUser, async (c) => {
  const user = c.get("user") as AuthedUser;
  const data = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMembers.role,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(desc(workspaces.updatedAt));

  return c.json({ data });
});

workspaceRoutes.post("/workspaces", requireUser, async (c) => {
  const user = c.get("user") as AuthedUser;
  const body = (await c.req.json().catch(() => null)) as null | { name?: string };
  if (!body?.name) return c.json({ message: "name is required" }, 400);

  const created = await db
    .insert(workspaces)
    .values({ name: body.name })
    .returning({ id: workspaces.id, name: workspaces.name });
  const workspace = created[0];

  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });

  return c.json({ data: workspace }, 201);
});

workspaceRoutes.get(
  "/workspaces/:id/members",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = Number(c.req.param("id"));
    const ctxWorkspaceId = c.get("workspaceId") as number;
    if (!Number.isFinite(workspaceId)) return c.json({ message: "invalid id" }, 400);
    if (workspaceId !== ctxWorkspaceId) return c.json({ message: "workspace mismatch" }, 400);

    const data = await db
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return c.json({ data });
  },
);

workspaceRoutes.post(
  "/workspaces/:id/members",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = Number(c.req.param("id"));
    const ctxWorkspaceId = c.get("workspaceId") as number;
    if (!Number.isFinite(workspaceId)) return c.json({ message: "invalid id" }, 400);
    if (workspaceId !== ctxWorkspaceId) return c.json({ message: "workspace mismatch" }, 400);

    const body = (await c.req.json().catch(() => null)) as null | { email?: string; name?: string | null; role?: WorkspaceRole };
    if (!body?.email) return c.json({ message: "email is required" }, 400);
    if (!body?.role) return c.json({ message: "role is required" }, 400);

    const newUser = await db
      .insert(users)
      .values({ email: body.email, name: body.name ?? null })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: body.name ?? null,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: users.id });

    const userId = newUser[0].id;
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
  },
);

workspaceRoutes.patch(
  "/workspaces/:id/members/:userId",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = Number(c.req.param("id"));
    const ctxWorkspaceId = c.get("workspaceId") as number;
    if (!Number.isFinite(workspaceId)) return c.json({ message: "invalid id" }, 400);
    if (workspaceId !== ctxWorkspaceId) return c.json({ message: "workspace mismatch" }, 400);

    const targetUserId = Number(c.req.param("userId"));
    if (!Number.isFinite(targetUserId)) return c.json({ message: "invalid userId" }, 400);

    const body = (await c.req.json().catch(() => null)) as null | { role?: WorkspaceRole };
    if (!body?.role) return c.json({ message: "role is required" }, 400);

    const updated = await db
      .update(workspaceMembers)
      .set({ role: body.role })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)))
      .returning();

    if (updated.length === 0) return c.json({ message: "not found" }, 404);
    return c.json({ data: updated[0] });
  },
);
