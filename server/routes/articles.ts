import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { articlePublications, articles, integrations, jobs } from "../drizzle/schema.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import type { AppEnv } from "../types.ts";

export const articleRoutes = new Hono<AppEnv>();

articleRoutes.get(
  "/articles",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const status = c.req.query("status");
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
    const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);

    const where = status
      ? and(eq(articles.workspaceId, workspaceId), eq(articles.status, status))
      : eq(articles.workspaceId, workspaceId);

    const data = await db
      .select()
      .from(articles)
      .where(where)
      .orderBy(desc(articles.updatedAt))
      .limit(limit)
      .offset(offset);

    return c.json({ data, limit, offset });
  },
);

articleRoutes.get(
  "/articles/:id",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ message: "invalid id" }, 400);

    const row = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
      .limit(1);
    const article = row[0];
    if (!article) return c.json({ message: "not found" }, 404);

    return c.json({ data: article });
  },
);

articleRoutes.post("/articles", async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | {
    workspaceId?: number;
    integrationId?: number;
    sourceDocToken?: string;
    title?: string;
    coverAssetId?: number | null;
    coverUrl?: string | null;
    contentMd?: string;
    contentMdFinal?: string;
    status?: string;
  };

  if (!body?.workspaceId) return c.json({ message: "workspaceId is required" }, 400);
  if (!body?.integrationId) return c.json({ message: "integrationId is required" }, 400);
  if (!body?.sourceDocToken) return c.json({ message: "sourceDocToken is required" }, 400);
  if (!body?.title) return c.json({ message: "title is required" }, 400);

  const inserted = await db
    .insert(articles)
    .values({
      workspaceId: body.workspaceId,
      integrationId: body.integrationId,
      sourceDocToken: body.sourceDocToken,
      title: body.title,
      coverAssetId: body.coverAssetId ?? null,
      coverUrl: body.coverUrl ?? null,
      contentMd: body.contentMd ?? "",
      contentMdFinal: body.contentMdFinal ?? "",
      status: body.status ?? "draft",
    })
    .returning();

  return c.json({ data: inserted[0] }, 201);
});

articleRoutes.patch("/articles/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ message: "invalid id" }, 400);

  const body = (await c.req.json().catch(() => null)) as null | {
    title?: string;
    coverAssetId?: number | null;
    coverUrl?: string | null;
    contentMd?: string;
    contentMdFinal?: string;
    status?: string;
  };
  if (!body) return c.json({ message: "invalid json" }, 400);

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.coverAssetId !== undefined) patch.coverAssetId = body.coverAssetId;
  if (body.coverUrl !== undefined) patch.coverUrl = body.coverUrl;
  if (body.contentMd !== undefined) patch.contentMd = body.contentMd;
  if (body.contentMdFinal !== undefined) patch.contentMdFinal = body.contentMdFinal;
  if (body.status !== undefined) patch.status = body.status;

  const updated = await db.update(articles).set(patch).where(eq(articles.id, id)).returning();

  if (updated.length === 0) return c.json({ message: "not found" }, 404);
  return c.json({ data: updated[0] });
});

articleRoutes.post(
  "/articles/:id/publish",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin", "member"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const articleId = Number(c.req.param("id"));
    if (!Number.isFinite(articleId)) return c.json({ message: "invalid id" }, 400);

    const body = (await c.req.json().catch(() => null)) as null | {
      integrationId?: number;
      platformType?: number;
    };
    if (!body) return c.json({ message: "invalid json" }, 400);
    if (!Number.isFinite(body.integrationId)) return c.json({ message: "integrationId is required" }, 400);
    if (!Number.isFinite(body.platformType)) return c.json({ message: "platformType is required" }, 400);

    const [article] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId)))
      .limit(1);
    if (!article) return c.json({ message: "not found" }, 404);

    const [integration] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, body.integrationId as number), eq(integrations.workspaceId, workspaceId)))
      .limit(1);
    if (!integration) return c.json({ message: "integration not found" }, 404);

    const publicationRows = await db
      .insert(articlePublications)
      .values({
        workspaceId,
        articleId,
        integrationId: body.integrationId as number,
        platformType: body.platformType as number,
        status: "publishing",
      })
      .onConflictDoUpdate({
        target: [
          articlePublications.articleId,
          articlePublications.integrationId,
          articlePublications.platformType,
        ],
        set: {
          status: "publishing",
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: articlePublications.id, status: articlePublications.status });

    const jobRows = await db
      .insert(jobs)
      .values({
        workspaceId,
        queue: "publish_article",
        payload: {
          type: "publish_article",
          workspaceId,
          articleId,
          integrationId: body.integrationId as number,
          platformType: body.platformType as number,
        },
      })
      .returning({ id: jobs.id, queue: jobs.queue, scheduledAt: jobs.scheduledAt });

    return c.json({ data: { publication: publicationRows[0], job: jobRows[0] } }, 201);
  },
);

articleRoutes.get(
  "/articles/:id/publications",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const articleId = Number(c.req.param("id"));
    if (!Number.isFinite(articleId)) return c.json({ message: "invalid id" }, 400);

    const [article] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId)))
      .limit(1);
    if (!article) return c.json({ message: "not found" }, 404);

    const data = await db
      .select()
      .from(articlePublications)
      .where(and(eq(articlePublications.workspaceId, workspaceId), eq(articlePublications.articleId, articleId)));

    return c.json({ data });
  },
);
