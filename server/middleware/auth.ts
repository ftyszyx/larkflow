import { sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { db } from "../db.ts";
import { users } from "../drizzle/schema.ts";
import type { AppEnv } from "../types.ts";

export type AuthedUser = {
  id: number;
  email: string;
  name: string | null;
};

const getHeader = (c: Parameters<MiddlewareHandler<AppEnv>>[0], name: string) => {
  const value = c.req.header(name);
  return value && value.trim() ? value.trim() : null;
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
  const email = getHeader(c, "X-User-Email");
  if (!email) return c.json({ message: "missing X-User-Email" }, 401);

  const name = getHeader(c, "X-User-Name");
  const rows = await db
    .insert(users)
    .values({ email, name })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: users.id, email: users.email, name: users.name });

  c.set("user", rows[0] as AuthedUser);
  await next();
};
