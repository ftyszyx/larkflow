import { Hono } from "hono";
import { requireUser, type AuthedUser } from "../middleware/auth.ts";
import type { AppEnv } from "../types.ts";
import { ok } from "../utils/response.ts";

export const meRoutes = new Hono<AppEnv>();

meRoutes.get("/me", requireUser, (c) => {
  const user = c.get("user") as AuthedUser;
  return ok(c, user);
});
