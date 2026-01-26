-- 用户表
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
-- workspace表
CREATE TABLE "workspaces" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workspaces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
-- workspace成员
CREATE TABLE "workspace_members" (
	"workspace_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_pk" PRIMARY KEY ("workspace_id", "user_id"),
	CONSTRAINT "workspace_members_role_check" CHECK ("role" IN ('owner', 'admin', 'member', 'viewer'))
);

-- workspace 邀请表（邀请制注册/加入）
CREATE TABLE "workspace_invitations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workspace_invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" bigint NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"accepted_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_role_check" CHECK ("role" IN ('owner', 'admin', 'member', 'viewer'))
);
--workspace下的平台列表配置  
CREATE TABLE "integrations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "integrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" bigint NOT NULL,
	"platform_type" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'enable' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_status_check" CHECK ("status" IN ('enable', 'disabled'))
);

-- 飞书空间同步状态表
CREATE TABLE "feishu_space_syncs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feishu_space_syncs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"integration_id" bigint NOT NULL,
	"doc_token" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_synced_at" timestamptz,
	"last_error" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "feishu_space_syncs_status_check" CHECK ("status" IN ('idle', 'syncing', 'failed', 'disabled'))
);

-- 文章表(从飞书知识库同步的文章)
CREATE TABLE "articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" bigint NOT NULL,
	"integration_id" bigint NOT NULL,
	"source_doc_token" text NOT NULL,
	"source_updated_at" timestamptz,
	"title" text NOT NULL,
	"cover_asset_id" bigint,
	"cover_url" text,
	"content_md" text DEFAULT '' NOT NULL,
	"content_md_final" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	"deleted_at" timestamptz,
	CONSTRAINT "articles_status_check" CHECK ("status" IN ('draft', 'ready', 'published', 'archived'))
);

-- 文章附件表
CREATE TABLE "assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" bigint NOT NULL,
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
	CONSTRAINT "assets_type_check" CHECK ("type" IN ('image', 'file'))
);

-- 工作空间设置
CREATE TABLE "workspace_settings" (
	"workspace_id" bigint NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_settings_pk" PRIMARY KEY ("workspace_id", "key")
);

-- 系统设置
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

INSERT INTO "system_settings" ("key", "value")
VALUES ('worker', '{"concurrency":1,"pollMs":1000,"lockSeconds":30}'::jsonb)
ON CONFLICT ("key") DO NOTHING;


--使用postgres做消息队列
-- 任务表
CREATE TABLE "jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_id" bigint,
	"queue" text NOT NULL,
	"job_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"scheduled_at" timestamptz DEFAULT now() NOT NULL,
	"locked_by" text,
	"locked_until" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 发布记录表
CREATE TABLE "article_publications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "article_publications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint NOT NULL,
	"integration_id" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"remote_id" text,
	"remote_url" text,
	"published_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "article_publications_status_check" CHECK ("status" IN ('draft', 'publishing', 'published', 'failed', 'archived'))
);

-- 其它的配置
-- workspace_members
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workspace_members_user_id" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint

-- users
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint

-- workspace_invitations
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspace_invitations_token" ON "workspace_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_workspace_invitations_workspace_id" ON "workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint

-- integrations
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_integrations_workspace_platform" ON "integrations" USING btree ("workspace_id","platform_type");--> statement-breakpoint

-- feishu_space_syncs
ALTER TABLE "feishu_space_syncs" ADD CONSTRAINT "feishu_space_syncs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_feishu_space_syncs_integration_doc" ON "feishu_space_syncs" USING btree ("integration_id","doc_token");--> statement-breakpoint
CREATE INDEX "idx_feishu_space_syncs_integration_status" ON "feishu_space_syncs" USING btree ("integration_id","status");--> statement-breakpoint

-- articles
ALTER TABLE "articles" ADD CONSTRAINT "articles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_articles_updated_at" ON "articles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_articles_status" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_articles_workspace_updated_at" ON "articles" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_articles_workspace_status" ON "articles" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_articles_integration_doc" ON "articles" USING btree ("integration_id","source_doc_token");--> statement-breakpoint
CREATE INDEX "idx_articles_doc_updated_at" ON "articles" USING btree ("integration_id","source_doc_token","source_updated_at");

-- article_sources
-- assets
ALTER TABLE "assets" ADD CONSTRAINT "assets_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assets_sha256" ON "assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "idx_assets_article_id" ON "assets" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_assets_workspace_article_id" ON "assets" USING btree ("workspace_id","article_id");--> statement-breakpoint

-- workspace_settings
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workspace_settings_workspace_id" ON "workspace_settings" USING btree ("workspace_id");--> statement-breakpoint

-- jobs
CREATE INDEX "idx_jobs_queue_sched" ON "jobs" USING btree ("queue","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_queue_lock" ON "jobs" USING btree ("queue","locked_until");--> statement-breakpoint
CREATE INDEX "idx_jobs_workspace_queue_sched" ON "jobs" USING btree ("workspace_id","queue","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_workspace_queue_job_key" ON "jobs" USING btree ("workspace_id","queue","job_key");

-- article_publications
ALTER TABLE "article_publications" ADD CONSTRAINT "article_publications_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_publications" ADD CONSTRAINT "article_publications_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_publications_article_integration" ON "article_publications" USING btree ("article_id","integration_id");--> statement-breakpoint
CREATE INDEX "idx_article_publications_article_updated_at" ON "article_publications" USING btree ("article_id","updated_at");--> statement-breakpoint