import { Hono } from "hono";
import { requireUser } from "../middleware/auth.ts";
import type { AuthedUser } from "../middleware/auth.ts";
import type { AppEnv } from "../types.ts";

export const meRoutes = new Hono<AppEnv>();

meRoutes.get("/me", requireUser, (c) => {
  const user = c.get("user") as AuthedUser;
  return c.json({ data: user });
});
