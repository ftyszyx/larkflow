import { eq, sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { db } from "../db.ts";
import { users } from "../drizzle/schema.ts";
import type { AppEnv } from "../types.ts";
import { verifyUserJwt } from "../utils/jwt.ts";

export type AuthedUser = {
  id: number;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
};

const getHeader = (c: Parameters<MiddlewareHandler<AppEnv>>[0], name: string) => {
  const value = c.req.header(name);
  return value && value.trim() ? value.trim() : null;
};

const getBearerToken = (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => {
  const auth = getHeader(c, "Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
};

export const requireApiKey: MiddlewareHandler<AppEnv> = async (c, next) => {
  const expected = Deno.env.get("API_KEY");
  if (expected) {
    const provided = getHeader(c, "X-Api-Key");
    if (!provided || provided !== expected) return c.json({ message: "unauthorized" }, 401);
  }
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getBearerToken(c);
  if (!token) return c.json({ message: "missing Authorization" }, 401);

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

  // If user was deleted, treat as unauthorized.
  if (!row) return c.json({ message: "unauthorized" }, 401);

  // Keep email normalized if changed.
  if (row.email !== claims.email) {
    await db.update(users).set({ email: claims.email, updatedAt: sql`now()` }).where(eq(users.id, row.id));
  }

  c.set("user", row as AuthedUser);
  await next();
};

export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user") as AuthedUser | undefined;
  if (!user?.isPlatformAdmin) return c.json({ message: "forbidden" }, 403);
  await next();
};
