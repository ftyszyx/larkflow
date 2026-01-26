import { Hono } from "hono";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { users, workspaceInvitations, workspaceMembers } from "../drizzle/schema.ts";
import type { AppEnv } from "../types.ts";
import { hashPassword } from "../utils/password.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import { fail, ok } from "../utils/response.ts";

export const invitationRoutes = new Hono<AppEnv>();

export const invitationScopedRoutes = new Hono<AppEnv>();

type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

invitationRoutes.post("/invitations/accept", async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | {
    token?: string;
    name?: string | null;
    password?: string;
  };
  if (!body?.token) return fail(c, 400, "token is required");
  if (!body?.password) return fail(c, 400, "password is required");

  const token = body.token.trim();

  const [inv] = await db
    .select()
    .from(workspaceInvitations)
    .where(and(eq(workspaceInvitations.token, token), isNull(workspaceInvitations.acceptedAt)))
    .limit(1);

  if (!inv) return fail(c, 404, "invalid token");
  if (new Date(inv.expiresAt).getTime() < Date.now()) return fail(c, 400, "token expired");

  const email = inv.email.trim().toLowerCase();
  const passwordHash = await hashPassword(body.password);

  const insertedUser = await db
    .insert(users)
    .values({ email, name: body.name ?? null, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: body.name ?? null,
        passwordHash,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: users.id });

  const userId = insertedUser[0].id;

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: inv.workspaceId, userId, role: inv.role as WorkspaceRole })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role: inv.role as WorkspaceRole },
    });

  await db
    .update(workspaceInvitations)
    .set({ acceptedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(workspaceInvitations.id, inv.id));

  return ok(c, { workspaceId: inv.workspaceId }, 201);
});

invitationScopedRoutes.post(
  "/invitations",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const user = c.get("user");

    const body = (await c.req.json().catch(() => null)) as null | {
      email?: string;
      role?: WorkspaceRole;
      expires_in_days?: number;
    };
    if (!body?.email) return fail(c, 400, "email is required");
    if (!body?.role) return fail(c, 400, "role is required");

    const email = body.email.trim().toLowerCase();
    const expiresInDays = Math.min(Math.max(Number(body.expires_in_days ?? 7) || 7, 1), 365);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const rows = await db
      .insert(workspaceInvitations)
      .values({
        workspaceId,
        token,
        email,
        role: body.role,
        createdByUserId: user.id,
        expiresAt,
        acceptedAt: null,
      })
      .returning({ token: workspaceInvitations.token, expiresAt: workspaceInvitations.expiresAt });

    return ok(c, rows[0], 201);
  },
);
