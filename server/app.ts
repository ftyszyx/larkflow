import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "./db.ts";
import { authRoutes } from "./routes/auth.ts";
import { invitationRoutes, invitationScopedRoutes } from "./routes/invitations.ts";
import { platformRoutes } from "./routes/platform.ts";
import { workspaceRoutes, workspaceScopedRoutes } from "./routes/workspaces.ts";
import { articleRoutes } from "./routes/articles.ts";
import { integrationRoutes } from "./routes/integrations.ts";
import { integrationSyncRoutes } from "./routes/feishu_sync.ts";
import { articlePublicationRoutes } from "./routes/article_publications.ts";
import { jobRoutes } from "./routes/jobs.ts";
import { settingsRoutes } from "./routes/settings.ts";
import type { AppEnv } from "./types.ts";

export const app = new Hono<AppEnv>();

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
//工作区相关
app.route("/api/w/:workspaceId", workspaceScopedRoutes);
//邀请相关
app.route("/api/w/:workspaceId", invitationScopedRoutes);
//平台信息
app.route("/api/w/:workspaceId", integrationRoutes);
//同步相关
app.route("/api/w/:workspaceId", integrationSyncRoutes);
//文章相关
app.route("/api/w/:workspaceId", articleRoutes);
//发布记录相关
app.route("/api/w/:workspaceId", articlePublicationRoutes);
//任务相关
app.route("/api/w/:workspaceId", jobRoutes);
//设置相关
app.route("/api/w/:workspaceId", settingsRoutes);
