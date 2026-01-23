import { relations } from "drizzle-orm/relations";
import { articles, articleSources, assets, publishJobs, syncRuns } from "./schema.ts";

export const articleSourcesRelations = relations(articleSources, ({ one }) => ({
	article: one(articles, {
		fields: [articleSources.articleId],
		references: [articles.id]
	}),
}));

export const articlesRelations = relations(articles, ({ many }) => ({
	articleSources: many(articleSources),
	assets: many(assets),
	publishJobs: many(publishJobs),
	syncRuns: many(syncRuns),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
	article: one(articles, {
		fields: [assets.articleId],
		references: [articles.id]
	}),
}));

export const publishJobsRelations = relations(publishJobs, ({ one }) => ({
	article: one(articles, {
		fields: [publishJobs.articleId],
		references: [articles.id]
	}),
}));

export const syncRunsRelations = relations(syncRuns, ({ one }) => ({
	article: one(articles, {
		fields: [syncRuns.articleId],
		references: [articles.id]
	}),
}));