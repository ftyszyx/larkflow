import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { articlePublications, articles } from "../drizzle/schema.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";
import { fail, ok } from "../utils/response.ts";

export const articlePublicationRoutes = new Hono<AppEnv>();

articlePublicationRoutes.get(
  "/articles/:id/publications",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const articleId = Number(c.req.param("id"));
    if (!Number.isFinite(articleId)) return fail(c, 400, "invalid id");

    const [article] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId)))
      .limit(1);
    if (!article) return fail(c, 404, "not found");

    const data = await db.select().from(articlePublications).where(eq(articlePublications.articleId, articleId));

    return ok(c, data);
  },
);
