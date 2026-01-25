import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db.ts";
import { articlePublications } from "../../drizzle/schema.ts";

type PublishArticlePayload = {
  type: "publish_article";
  workspaceId: number;
  articleId: number;
  integrationId: number;
  platformType: number;
};

export const handlePublishArticle = async (payload: PublishArticlePayload) => {
  const workspaceId = Number(payload.workspaceId);
  const articleId = Number(payload.articleId);
  const integrationId = Number(payload.integrationId);
  const platformType = Number(payload.platformType);

  if (!Number.isFinite(workspaceId)) throw new Error("invalid workspaceId");
  if (!Number.isFinite(articleId)) throw new Error("invalid articleId");
  if (!Number.isFinite(integrationId)) throw new Error("invalid integrationId");
  if (!Number.isFinite(platformType)) throw new Error("invalid platformType");

  // NOTE: actual publishing to external platform is not implemented yet.
  // We mark the publication as failed so the frontend can observe the lifecycle.
  const updated = await db
    .update(articlePublications)
    .set({
      status: "failed",
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(articlePublications.workspaceId, workspaceId),
        eq(articlePublications.articleId, articleId),
        eq(articlePublications.integrationId, integrationId),
        eq(articlePublications.platformType, platformType),
      ),
    )
    .returning({ id: articlePublications.id });

  if (updated.length === 0) {
    throw new Error("publication not found");
  }
};
