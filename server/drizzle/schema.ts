import { pgTable, index, bigint, text, jsonb, integer, timestamp, check, uniqueIndex, foreignKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const jobs = pgTable("jobs", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "jobs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	queue: text().notNull(),
	payload: jsonb().default({}).notNull(),
	attempts: integer().default(0).notNull(),
	maxAttempts: integer("max_attempts").default(5).notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lockedBy: text("locked_by"),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_jobs_queue_lock").using("btree", table.queue.asc().nullsLast().op("timestamptz_ops"), table.lockedUntil.asc().nullsLast().op("text_ops")),
	index("idx_jobs_queue_sched").using("btree", table.queue.asc().nullsLast().op("timestamptz_ops"), table.scheduledAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const articles = pgTable("articles", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "articles_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	title: text().notNull(),
	summary: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	coverAssetId: bigint("cover_asset_id", { mode: "number" }),
	coverUrl: text("cover_url"),
	contentMd: text("content_md").default('').notNull(),
	contentMdFinal: text("content_md_final").default('').notNull(),
	status: text().default('draft').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_articles_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_articles_updated_at").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	check("articles_status_check", sql`status = ANY (ARRAY['draft'::text, 'ready'::text, 'published'::text, 'archived'::text])`),
]);

export const articleSources = pgTable("article_sources", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "article_sources_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	articleId: bigint("article_id", { mode: "number" }).notNull(),
	source: text().notNull(),
	sourceDocToken: text("source_doc_token").notNull(),
	sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_article_sources_doc_updated_at").using("btree", table.source.asc().nullsLast().op("timestamptz_ops"), table.sourceDocToken.asc().nullsLast().op("text_ops"), table.sourceUpdatedAt.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("uq_article_sources_source_doc").using("btree", table.source.asc().nullsLast().op("text_ops"), table.sourceDocToken.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.articleId],
		foreignColumns: [articles.id],
		name: "article_sources_article_id_articles_id_fk"
	}).onDelete("cascade"),
]);

export const assets = pgTable("assets", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "assets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	articleId: bigint("article_id", { mode: "number" }),
	type: text().default('image').notNull(),
	sourceUrl: text("source_url"),
	sourceKey: text("source_key"),
	mime: text(),
	sha256: text(),
	ossBucket: text("oss_bucket"),
	ossKey: text("oss_key"),
	ossUrl: text("oss_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_assets_article_id").using("btree", table.articleId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("uq_assets_sha256").using("btree", table.sha256.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.articleId],
		foreignColumns: [articles.id],
		name: "assets_article_id_articles_id_fk"
	}).onDelete("set null"),
	check("assets_type_check", sql`type = ANY (ARRAY['image'::text, 'cover'::text])`),
]);

export const publishJobs = pgTable("publish_jobs", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "publish_jobs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	articleId: bigint("article_id", { mode: "number" }).notNull(),
	platform: text().notNull(),
	status: text().default('queued').notNull(),
	error: text(),
	requestPayload: jsonb("request_payload").default({}).notNull(),
	responsePayload: jsonb("response_payload").default({}).notNull(),
	remoteDraftId: text("remote_draft_id"),
	remotePublishId: text("remote_publish_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_publish_jobs_article").using("btree", table.articleId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("int8_ops")),
	index("idx_publish_jobs_platform").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	index("idx_publish_jobs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.articleId],
		foreignColumns: [articles.id],
		name: "publish_jobs_article_id_articles_id_fk"
	}).onDelete("cascade"),
	check("publish_jobs_status_check", sql`status = ANY (ARRAY['queued'::text, 'running'::text, 'success'::text, 'failed'::text])`),
]);

export const syncRuns = pgTable("sync_runs", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "sync_runs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	source: text().notNull(),
	sourceDocToken: text("source_doc_token").notNull(),
	sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	articleId: bigint("article_id", { mode: "number" }),
	status: text().notNull(),
	error: text(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sync_runs_doc").using("btree", table.source.asc().nullsLast().op("text_ops"), table.sourceDocToken.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_sync_runs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.articleId],
		foreignColumns: [articles.id],
		name: "sync_runs_article_id_articles_id_fk"
	}).onDelete("set null"),
]);
