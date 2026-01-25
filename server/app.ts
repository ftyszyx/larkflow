import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "./db.ts";
import { requireApiKey } from "./middleware/auth.ts";
import { authRoutes } from "./routes/auth.ts";
import { invitationRoutes, invitationScopedRoutes } from "./routes/invitations.ts";
import { platformRoutes } from "./routes/platform.ts";
import { workspaceRoutes, workspaceScopedRoutes } from "./routes/workspaces.ts";
import { articleRoutes } from "./routes/articles.ts";
import { integrationRoutes } from "./routes/integrations.ts";
import type { AppEnv } from "./types.ts";

export const app = new Hono<AppEnv>();

// Optional system-level gate (e.g. internal deployment). For product mode, leave API_KEY empty.
app.use("/api/*", requireApiKey);

app.get("/", (c) => c.text("Hello Hono!"));

app.get("/healthz", async (c) => {
  const rows = await db.execute<{ ok: number }>(sql`select 1 as ok`);
  return c.json({ ok: true, db: rows.rows?.[0]?.ok ?? 1 });
});

// Auth + invitation (no workspace scope)
app.route("/api", authRoutes);
app.route("/api", invitationRoutes);
app.route("/api", platformRoutes);
app.route("/api", workspaceRoutes);

// Workspace-scoped APIs (strong switch)
app.route("/api/w/:workspaceId", workspaceScopedRoutes);
app.route("/api/w/:workspaceId", invitationScopedRoutes);
app.route("/api/w/:workspaceId", integrationRoutes);
app.route("/api/w/:workspaceId", articleRoutes);
