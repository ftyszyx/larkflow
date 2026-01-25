import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "./db.ts";
import { requireApiKey } from "./middleware/auth.ts";
import { meRoutes } from "./routes/me.ts";
import { workspaceRoutes } from "./routes/workspaces.ts";
import { articleRoutes } from "./routes/articles.ts";
import { integrationRoutes } from "./routes/integrations.ts";
import type { AppEnv } from "./types.ts";

export const app = new Hono<AppEnv>();

app.use("*", requireApiKey);

app.get("/", (c) => c.text("Hello Hono!"));

app.get("/healthz", async (c) => {
  const rows = await db.execute<{ ok: number }>(sql`select 1 as ok`);
  return c.json({ ok: true, db: rows.rows?.[0]?.ok ?? 1 });
});

app.route("/", meRoutes);
app.route("/", workspaceRoutes);
app.route("/", integrationRoutes);
app.route("/", articleRoutes);
