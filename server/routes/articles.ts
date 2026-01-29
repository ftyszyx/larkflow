import { Hono } from "hono";
import { and, desc, eq, isNull as _isNull, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { articleCovers, articlePublications, articles, assets as _assets, integrations, jobs } from "../drizzle/schema.ts";
import { JobQueue } from "../constants/jobs.ts";
import type { AppEnv } from "../types.ts";
import { requireUser } from "../middleware/auth.ts";
import { requireRole, requireWorkspace, requireWorkspaceMember } from "../middleware/workspace.ts";
import { putObject } from "../utils/oss.ts";
import { downloadImageBytes, guessImageExt } from "../utils/grs_draw.ts";
import { loadResolvedWorkspaceAiConfig } from "../utils/ai_settings.ts";
import { getDefaultCoverPresets } from "../constants/ai_cover_presets.ts";
import { createProviders } from "../ai/providers/registry.ts";
import { fail, ok, okList } from "../utils/response.ts";

export const articleRoutes = new Hono<AppEnv>();

articleRoutes.get("/articles", requireUser, requireWorkspace, requireWorkspaceMember, async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const status = c.req.query("status");
  const page = Math.max(Number(c.req.query("page") ?? 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(c.req.query("page_size") ?? 50) || 50, 1), 200);
  const offset = (page - 1) * pageSize;

  const baseWhere = and(eq(articles.workspaceId, workspaceId), _isNull(articles.deletedAt));
  const where = status ? and(baseWhere, eq(articles.status, status)) : baseWhere;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(articles)
    .where(where);
  const total = Number(countRow?.total ?? 0);

  const data = await db.select().from(articles).where(where).orderBy(desc(articles.updatedAt)).limit(pageSize).offset(offset);

  return okList(c, data, total);
});

articleRoutes.get("/articles/:id", requireUser, requireWorkspace, requireWorkspaceMember, async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

  const row = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId), _isNull(articles.deletedAt)))
    .limit(1);
  const article = row[0];
  if (!article) return fail(c, 404, "not found");

  return ok(c, article);
});

articleRoutes.post("/articles", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin", "member"]), async (c) => {
  const body = (await c.req.json().catch(() => null)) as null | {
    integration_id?: number;
    source_doc_url?: string;
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
      sourceDocUrl: body.source_doc_url ?? "",
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
});

articleRoutes.patch("/articles/:id", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin", "member"]), async (c) => {
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
    .where(and(eq(articles.id, id), eq(articles.workspaceId, ctxWorkspaceId), _isNull(articles.deletedAt)))
    .returning();

  if (updated.length === 0) return fail(c, 404, "not found");
  return ok(c, updated[0]);
});

articleRoutes.post(
  "/articles/:id/ai/generate",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin", "member"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

    const ai = await loadResolvedWorkspaceAiConfig(workspaceId);
    const providers = createProviders(ai);

    const body = (await c.req.json().catch(() => null)) as null | {
      generate_covers?: boolean;
      platform_type?: number;
      preset_key?: string;
      preset_keys?: string[];
      width?: number;
      height?: number;
    };
    const generateCovers = !!body?.generate_covers;
    const platformType = Number.isFinite(body?.platform_type) ? (body?.platform_type as number) : 2;
    const hasPresetKey = typeof body?.preset_key === "string" && body.preset_key.trim().length > 0;
    const presetKey = hasPresetKey ? body!.preset_key!.trim() : "default";
    const presetKeys = Array.isArray(body?.preset_keys)
      ? body!.preset_keys
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 10)
      : null;
    const width = Number.isFinite(body?.width) ? (body?.width as number) : 1200;
    const height = Number.isFinite(body?.height) ? (body?.height as number) : 630;

    const row = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId), _isNull(articles.deletedAt)))
      .limit(1);
    const article = row[0];
    if (!article) return fail(c, 404, "not found");

    const rawContent = (article.contentMdFinal || article.contentMd || "").trim();
    const fallbackSummary = rawContent ? rawContent.slice(0, 160) : article.title;
    const fallbackCoverPrompt = `Cover image for: ${article.title}. Style: clean, modern, minimal, high-contrast.`;
    const fallbackOptimized = rawContent ? rawContent : `# ${article.title}\n\n${fallbackSummary}`;

    let suggestedTitles: string[] = [];
    let summary = fallbackSummary;
    let coverPrompt = fallbackCoverPrompt;
    let optimizedContentMd = fallbackOptimized;

    try {
      const completion = await providers.chat.complete({
        model: ai.grsChat.model,
        messages: [
          {
            role: "system",
            content:
              "Return ONLY valid JSON with keys: suggestedTitles (string[]), summary (string), coverPrompt (string), optimizedContentMd (string).",
          },
          {
            role: "user",
            content: JSON.stringify({
              title: article.title,
              content: rawContent,
            }),
          },
        ],
      }, { workspaceId });

      const txt = completion.content;
      const parsed = JSON.parse(txt) as {
        suggestedTitles?: unknown;
        summary?: unknown;
        coverPrompt?: unknown;
        optimizedContentMd?: unknown;
      };

      if (Array.isArray(parsed.suggestedTitles)) {
        suggestedTitles = parsed.suggestedTitles
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, 5);
      }
      if (typeof parsed.summary === "string" && parsed.summary.trim()) summary = parsed.summary.trim();
      if (typeof parsed.coverPrompt === "string" && parsed.coverPrompt.trim()) coverPrompt = parsed.coverPrompt.trim();
      if (typeof parsed.optimizedContentMd === "string" && parsed.optimizedContentMd.trim()) optimizedContentMd = parsed.optimizedContentMd;
    } catch {
      // fallback to local heuristics
    }

    const draft = {
      suggestedTitles,
      summary,
      coverPrompt,
      optimizedContentMd,
    };

    const generatedCovers: Array<{
      id: number;
      platformType: number;
      presetKey: string;
      width: number;
      height: number;
      url: string;
    }> = [];

    if (generateCovers) {
      const defaults = getDefaultCoverPresets(platformType);
      const presetsToUse = presetKeys
        ? defaults.filter((p) => presetKeys.includes(p.presetKey))
        : (!hasPresetKey ? defaults : defaults.filter((p) => p.presetKey === presetKey));

      const finalPresetsToUse = presetsToUse.length > 0
        ? presetsToUse
        : [{ presetKey, aspectRatio: ai.nanoBanana.aspectRatio, imageSize: ai.nanoBanana.imageSize, width, height }];

      for (const preset of finalPresetsToUse) {
        const draw = await providers.image.draw(
          {
            model: ai.nanoBanana.model,
            prompt: coverPrompt,
            aspectRatio: preset.aspectRatio,
            imageSize: preset.imageSize,
          },
          { workspaceId },
        );

        const { bytes, contentType } = await downloadImageBytes(draw.url);
        const ext = guessImageExt(contentType, draw.url);
        const objectKey = `ai_covers/${id}/${platformType}/${preset.presetKey}/${Date.now()}.${ext}`;

        const uploaded = await putObject(workspaceId, objectKey, bytes);
        const inserted = await db
          .insert(articleCovers)
          .values({
            workspaceId,
            articleId: id,
            platformType,
            presetKey: preset.presetKey,
            width: preset.width,
            height: preset.height,
            prompt: coverPrompt,
            provider: providers.image.key,
            objectKey,
            url: uploaded.url,
            isActive: false,
          })
          .returning({ id: articleCovers.id, url: articleCovers.url });

        const coverId = inserted[0]?.id;
        const coverUrl = inserted[0]?.url;
        if (coverId && coverUrl) {
          generatedCovers.push({
            id: coverId,
            platformType,
            presetKey: preset.presetKey,
            width: preset.width,
            height: preset.height,
            url: coverUrl,
          });
        }
      }
    }

    return ok(c, { draft, generatedCovers });
  },
);

articleRoutes.post(
  "/articles/:id/ai/apply",
  requireUser,
  requireWorkspace,
  requireWorkspaceMember,
  requireRole(["owner", "admin", "member"]),
  async (c) => {
    const workspaceId = c.get("workspaceId") as number;
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

    const body = (await c.req.json().catch(() => null)) as null | {
      title_final?: string | null;
      content_md_final?: string;
      cover_id?: number;
    };
    if (!body) return fail(c, 400, "invalid json");

    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    if (body.title_final !== undefined) patch.titleFinal = body.title_final;
    if (body.content_md_final !== undefined) patch.contentMdFinal = body.content_md_final;

    if (body.cover_id !== undefined && body.cover_id !== null) {
      const coverId = Number(body.cover_id);
      if (!Number.isFinite(coverId)) return fail(c, 400, "invalid cover_id");

      const rows = await db
        .select()
        .from(articleCovers)
        .where(and(eq(articleCovers.id, coverId), eq(articleCovers.workspaceId, workspaceId), eq(articleCovers.articleId, id)))
        .limit(1);
      const cover = rows[0];
      if (!cover) return fail(c, 404, "cover not found");

      await db
        .update(articleCovers)
        .set({ isActive: false, updatedAt: sql`now()` })
        .where(
          and(
            eq(articleCovers.workspaceId, workspaceId),
            eq(articleCovers.articleId, id),
            eq(articleCovers.platformType, cover.platformType),
            eq(articleCovers.presetKey, cover.presetKey),
            eq(articleCovers.isActive, true),
          ),
        );

      await db
        .update(articleCovers)
        .set({ isActive: true, updatedAt: sql`now()` })
        .where(and(eq(articleCovers.id, coverId), eq(articleCovers.workspaceId, workspaceId)));

      patch.coverUrl = cover.url;
    }

    const updated = await db
      .update(articles)
      .set(patch)
      .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId), _isNull(articles.deletedAt)))
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
      .where(and(eq(articles.id, articleId), eq(articles.workspaceId, workspaceId), _isNull(articles.deletedAt)))
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

articleRoutes.delete("/articles/:id", requireUser, requireWorkspace, requireWorkspaceMember, requireRole(["owner", "admin", "member"]), async (c) => {
  const workspaceId = c.get("workspaceId") as number;
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return fail(c, 400, "invalid id");

  const updated = await db
    .update(articles)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(articles.id, id), eq(articles.workspaceId, workspaceId), _isNull(articles.deletedAt)))
    .returning({ id: articles.id });

  if (updated.length === 0) return fail(c, 404, "not found");
  return ok(c, updated[0]);
});
