CREATE TABLE "article_sources" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "article_sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint NOT NULL,
	"source" text NOT NULL,
	"source_doc_token" text NOT NULL,
	"source_updated_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"summary" text,
	"cover_asset_id" bigint,
	"cover_url" text,
	"content_md" text DEFAULT '' NOT NULL,
	"content_md_final" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "articles_status_check" CHECK ("status" IN ('draft', 'ready', 'published', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint,
	"type" text DEFAULT 'image' NOT NULL,
	"source_url" text,
	"source_key" text,
	"mime" text,
	"sha256" text,
	"oss_bucket" text,
	"oss_key" text,
	"oss_url" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "assets_type_check" CHECK ("type" IN ('image', 'cover'))
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"queue" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"scheduled_at" timestamptz DEFAULT now() NOT NULL,
	"locked_by" text,
	"locked_until" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "publish_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"request_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"remote_draft_id" text,
	"remote_publish_id" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "publish_jobs_status_check" CHECK ("status" IN ('queued', 'running', 'success', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"source_doc_token" text NOT NULL,
	"source_updated_at" timestamptz,
	"article_id" bigint,
	"status" text NOT NULL,
	"error" text,
	"started_at" timestamptz,
	"finished_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_sources_source_doc" ON "article_sources" USING btree ("source","source_doc_token");--> statement-breakpoint
CREATE INDEX "idx_article_sources_doc_updated_at" ON "article_sources" USING btree ("source","source_doc_token","source_updated_at");--> statement-breakpoint
CREATE INDEX "idx_articles_updated_at" ON "articles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_articles_status" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assets_sha256" ON "assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "idx_assets_article_id" ON "assets" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_queue_sched" ON "jobs" USING btree ("queue","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_queue_lock" ON "jobs" USING btree ("queue","locked_until");--> statement-breakpoint
CREATE INDEX "idx_publish_jobs_article" ON "publish_jobs" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_publish_jobs_status" ON "publish_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_publish_jobs_platform" ON "publish_jobs" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_doc" ON "sync_runs" USING btree ("source","source_doc_token","created_at");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_status" ON "sync_runs" USING btree ("status");