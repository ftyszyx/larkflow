import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db.ts";
import { articlePublications, articles, integrations } from "../../drizzle/schema.ts";
import { JobQueue } from "../../constants/jobs.ts";
import { PlatformType } from "../../constants/platform.ts";
import { createPublisher } from "../../publishers/factory.ts";

type PublishArticlePayload = {
  type: JobQueue.PublishArticle;
  articleId: number;
  integrationId: number;
};

export const handlePublishArticle = async (payload: PublishArticlePayload) => {
  const articleId = Number(payload.articleId);
  const integrationId = Number(payload.integrationId);

  if (!Number.isFinite(articleId)) throw new Error("invalid articleId");
  if (!Number.isFinite(integrationId)) throw new Error("invalid integrationId");

  const [row] = await db
    .select({
      workspaceId: integrations.workspaceId,
      platformType: integrations.platformType,
      config: integrations.config,
      articleTitle: articles.title,
      articleContent: articles.contentMdFinal,
      articleCoverUrl: articles.coverUrl,
    })
    .from(integrations)
    .innerJoin(articles, eq(articles.id, articleId))
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!row) throw new Error("integration or article not found");

  const platformType = row.platformType as PlatformType;

  try {
    const publisher = createPublisher(platformType);
    const result = await publisher.publish({
      workspaceId: row.workspaceId as number,
      integrationId,
      article: {
        id: articleId,
        title: row.articleTitle,
        contentMdFinal: row.articleContent,
        coverUrl: row.articleCoverUrl,
      },
      integration: {
        platformType,
        config: (row.config as Record<string, unknown>) ?? {},
      },
    });

    const updated = await db
      .update(articlePublications)
      .set({
        status: "published",
        remoteId: result.remoteId,
        remoteUrl: result.remoteUrl ?? null,
        publishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(articlePublications.articleId, articleId),
          eq(articlePublications.integrationId, integrationId),
        ),
      )
      .returning({ id: articlePublications.id });

    if (updated.length === 0) throw new Error("publication not found");
  } catch (e) {
    const updated = await db
      .update(articlePublications)
      .set({
        status: "failed",
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(articlePublications.articleId, articleId),
          eq(articlePublications.integrationId, integrationId),
        ),
      )
      .returning({ id: articlePublications.id });

    if (updated.length === 0) throw new Error("publication not found");
    throw e;
  }
};
