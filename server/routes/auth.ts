import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { users, workspaceMembers, workspaces } from "../drizzle/schema.ts";
import type { AppEnv } from "../types.ts";
import { signUserJwt } from "../utils/jwt.ts";
import { verifyPassword } from "../utils/password.ts";
import { requireUser } from "../middleware/auth.ts";
import { fail, ok } from "../utils/response.ts";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/auth/login", async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | { email?: string; password?: string };
  if (!body?.email) return fail(c, 400, "email is required");
  if (!body?.password) return fail(c, 400, "password is required");

  const email = body.email.trim().toLowerCase();
  const [u] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!u?.passwordHash) return fail(c, 401, "invalid credentials");

  const passwordOk = await verifyPassword(body.password, u.passwordHash);
  if (!passwordOk) return fail(c, 401, "invalid credentials");

  const token = await signUserJwt({ uid: u.id, email: u.email, isPlatformAdmin: !!u.isPlatformAdmin });
  return ok(c, { token });
});

authRoutes.get("/auth/me", requireUser, async (c) => {
  const user = c.get("user");

  const memberships = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(sql`workspaces.updated_at desc`);

  return ok(c, { user, workspaces: memberships });
});
