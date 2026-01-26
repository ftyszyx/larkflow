import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db.ts";
import { articlePublications } from "../../drizzle/schema.ts";
import { JobQueue } from "../../constants/jobs.ts";

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
        eq(articlePublications.articleId, articleId),
        eq(articlePublications.integrationId, integrationId),
      ),
    )
    .returning({ id: articlePublications.id });

  if (updated.length === 0) {
    throw new Error("publication not found");
  }
};
