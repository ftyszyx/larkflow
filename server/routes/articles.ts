import { Hono } from "hono";
import { and, desc, eq, isNull as _isNull, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { articlePublications, articles, assets as _assets, integrations, jobs } from "../drizzle/schema.ts";
import { JobQueue } from "../constants/jobs.ts";
import type { AppEnv } from "../types.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import { fail, ok } from "../utils/response.ts";

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

    return ok(c, { items: data, limit, offset });
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
    if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

    const row = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId)))
      .limit(1);
    const article = row[0];
    if (!article) return fail(c, 404, "not found");

    return ok(c, article);
  },
);

articleRoutes.post(
  "/articles",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin", "member"]),
  async (c) => {
    const body = (await c.req.json().catch(() => null)) as null | {
      integration_id?: number;
      source_doc_token?: string;
      title?: string;
      cover_asset_id?: number | null;
      cover_url?: string | null;
      content_md?: string;
      content_md_final?: string;
      status?: string;
    };

    if (!body?.integration_id) return fail(c, 400, "integration_id is required");
    if (!body?.source_doc_token) return fail(c, 400, "source_doc_token is required");
    if (!body?.title) return fail(c, 400, "title is required");

    const ctxWorkspaceId = c.get("workspaceId") as number | undefined;
    if (!ctxWorkspaceId) return fail(c, 400, "workspaceId is required");

    const [integration] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, body.integration_id), eq(integrations.workspaceId, ctxWorkspaceId)))
      .limit(1);
    if (!integration) return fail(c, 404, "integration not found");

    const inserted = await db
      .insert(articles)
      .values({
        workspaceId: ctxWorkspaceId,
        integrationId: body.integration_id,
        sourceDocToken: body.source_doc_token,
        title: body.title,
        coverAssetId: body.cover_asset_id ?? null,
        coverUrl: body.cover_url ?? null,
        contentMd: body.content_md ?? "",
        contentMdFinal: body.content_md_final ?? "",
        status: body.status ?? "draft",
      })
      .returning();

    return ok(c, inserted[0], 201);
  },
);

articleRoutes.patch(
  "/articles/:id",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin", "member"]),
  async (c) => {
    const ctxWorkspaceId = c.get("workspaceId") as number | undefined;
    if (!ctxWorkspaceId) return fail(c, 400, "workspaceId is required");

    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

    const body = (await c.req.json().catch(() => null)) as null | {
      title?: string;
      cover_asset_id?: number | null;
      cover_url?: string | null;
      content_md?: string;
      content_md_final?: string;
      status?: string;
    };
    if (!body) return fail(c, 400, "invalid json");

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.cover_asset_id !== undefined) patch.coverAssetId = body.cover_asset_id;
    if (body.cover_url !== undefined) patch.coverUrl = body.cover_url;
    if (body.content_md !== undefined) patch.contentMd = body.content_md;
    if (body.content_md_final !== undefined) patch.contentMdFinal = body.content_md_final;
    if (body.status !== undefined) patch.status = body.status;

    const updated = await db
      .update(articles)
      .set(patch)
      .where(and(eq(articles.id, id), eq(articles.workspaceId, ctxWorkspaceId)))
      .returning();

    if (updated.length === 0) return fail(c, 404, "not found");
    return ok(c, updated[0]);
  },
);

articleRoutes.post(
  "/articles/:id/publish",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin", "member"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const articleId = Number(c.req.param("id"));
    if (!Number.isFinite(articleId)) return fail(c, 400, "invalid id");

    const body = (await c.req.json().catch(() => null)) as null | {
      integrations_id?: number;
    };
    if (!body) return fail(c, 400, "invalid json");
    if (!Number.isFinite(body.integrations_id)) return fail(c, 400, "integrations_id is required");

    const [article] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId)))
      .limit(1);
    if (!article) return fail(c, 404, "not found");

    const [integration] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.id, body.integrations_id as number), eq(integrations.workspaceId, workspaceId)))
      .limit(1);
    if (!integration) return fail(c, 404, "integration not found");

    const publicationRows = await db
      // schema.ts is generated by pull; during dev we may change SQL first.
      // deno-lint-ignore no-explicit-any
      .insert(articlePublications as any)
      .values({
        articleId,
        integrationId: body.integrations_id as number,
        status: "publishing",
      })
      .onConflictDoUpdate({
        // deno-lint-ignore no-explicit-any
        target: [(articlePublications as any).articleId, (articlePublications as any).integrationId],
        set: {
          status: "publishing",
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: articlePublications.id, status: articlePublications.status });

    const integrationId = body.integrations_id as number;
    const jobKey = `${integrationId}:${articleId}`;
    const [existingJob] = await db
      .select({ id: jobs.id, queue: jobs.queue, scheduledAt: jobs.scheduledAt })
      .from(jobs)
      .where(and(eq(jobs.workspaceId, workspaceId), eq(jobs.queue, JobQueue.PublishArticle), eq(jobs.jobKey, jobKey)))
      .limit(1);
    if (existingJob) return fail(c, 409, "duplicate job", 409, { existing: existingJob });

    const jobRows = await db
      .insert(jobs)
      .values({
        workspaceId,
        jobKey,
        queue: JobQueue.PublishArticle,
        payload: {
          type: JobQueue.PublishArticle,
          workspaceId,
          articleId,
          integrationId,
        },
      })
      .returning({ id: jobs.id, queue: jobs.queue, scheduledAt: jobs.scheduledAt });

    return ok(c, { publication: publicationRows[0], job: jobRows[0] }, 201);
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
    if (!Number.isFinite(articleId)) return fail(c, 400, "invalid id");

    const [article] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId)))
      .limit(1);
    if (!article) return fail(c, 404, "not found");

    const data = await db
      .select()
      .from(articlePublications)
      .where(eq(articlePublications.articleId, articleId));

    return ok(c, data);
  },
);
