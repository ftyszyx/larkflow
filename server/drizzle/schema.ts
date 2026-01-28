import { pgTable, text, jsonb, timestamp, index, uniqueIndex, bigint, integer, boolean, foreignKey, check, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const systemSettings = pgTable("system_settings", {
  key: text().primaryKey().notNull(),
  value: jsonb().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: "jobs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    workspaceId: bigint("workspace_id", { mode: "number" }),
    queue: text().notNull(),
    jobKey: text("job_key").notNull(),
    payload: jsonb().default({}).notNull(),
    attempts: integer().default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    lockedBy: text("locked_by"),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_jobs_queue_lock").using(
      "btree",
      table.queue.asc().nullsLast().op("text_ops"),
      table.lockedUntil.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_jobs_queue_sched").using(
      "btree",
      table.queue.asc().nullsLast().op("timestamptz_ops"),
      table.scheduledAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_jobs_workspace_queue_sched").using(
      "btree",
      table.workspaceId.asc().nullsLast().op("text_ops"),
      table.queue.asc().nullsLast().op("text_ops"),
      table.scheduledAt.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("uq_jobs_workspace_queue_job_key").using(
      "btree",
      table.workspaceId.asc().nullsLast().op("int8_ops"),
      table.queue.asc().nullsLast().op("int8_ops"),
      table.jobKey.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const workspaces = pgTable("workspaces", {
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  id: bigint({ mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ name: "workspaces_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
  name: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: "users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    email: text().notNull(),
    name: text(),
    passwordHash: text("password_hash"),
    isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uq_users_email").using("btree", table.email.asc().nullsLast().op("text_ops"))],
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "workspace_invitations_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 9223372036854775807,
        cache: 1,
      }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    workspaceId: bigint("workspace_id", { mode: "number" }).notNull(),
    token: text().notNull(),
    email: text().notNull(),
    role: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    createdByUserId: bigint("created_by_user_id", { mode: "number" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_workspace_invitations_workspace_id").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("uq_workspace_invitations_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "workspace_invitations_workspace_id_workspaces_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "workspace_invitations_created_by_user_id_users_id_fk",
    }).onDelete("cascade"),
    check("workspace_invitations_role_check", sql`role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])`),
  ],
);

export const integrations = pgTable(
  "integrations",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: "integrations_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    workspaceId: bigint("workspace_id", { mode: "number" }).notNull(),
    platformType: integer("platform_type").notNull(),
    name: text().notNull(),
    status: text().default("enable").notNull(),
    config: jsonb().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_integrations_workspace_platform").using(
      "btree",
      table.workspaceId.asc().nullsLast().op("int4_ops"),
      table.platformType.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "integrations_workspace_id_workspaces_id_fk",
    }).onDelete("cascade"),
    check("integrations_status_check", sql`status = ANY (ARRAY['enable'::text, 'disabled'::text])`),
  ],
);

export const feishuSpaceSyncs = pgTable(
  "feishu_space_syncs",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "feishu_space_syncs_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 9223372036854775807,
        cache: 1,
      }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    integrationId: bigint("integration_id", { mode: "number" }).notNull(),
    docToken: text("doc_token").notNull(),
    docUrl: text("doc_url").notNull(),
    docTitle: text("doc_title").notNull(),
    status: text().default("idle").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "string" }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_feishu_space_syncs_integration_status").using(
      "btree",
      table.integrationId.asc().nullsLast().op("int8_ops"),
      table.status.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("uq_feishu_space_syncs_integration_doc").using(
      "btree",
      table.integrationId.asc().nullsLast().op("text_ops"),
      table.docToken.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.integrationId],
      foreignColumns: [integrations.id],
      name: "feishu_space_syncs_integration_id_integrations_id_fk",
    }).onDelete("cascade"),
    check("feishu_space_syncs_status_check", sql`status = ANY (ARRAY['idle'::text, 'syncing'::text, 'failed'::text, 'disabled'::text])`),
  ],
);

export const articles = pgTable(
  "articles",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: "articles_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    workspaceId: bigint("workspace_id", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    integrationId: bigint("integration_id", { mode: "number" }).notNull(),
    sourceDocUrl: text("source_doc_url").notNull(),
    sourceDocToken: text("source_doc_token").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "string" }),
    title: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    coverAssetId: bigint("cover_asset_id", { mode: "number" }),
    coverUrl: text("cover_url"),
    contentMd: text("content_md").default("").notNull(),
    contentMdFinal: text("content_md_final").default("").notNull(),
    status: text().default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("idx_articles_doc_updated_at").using(
      "btree",
      table.integrationId.asc().nullsLast().op("timestamptz_ops"),
      table.sourceDocToken.asc().nullsLast().op("text_ops"),
      table.sourceUpdatedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_articles_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
    index("idx_articles_updated_at").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
    index("idx_articles_workspace_status").using(
      "btree",
      table.workspaceId.asc().nullsLast().op("int8_ops"),
      table.status.asc().nullsLast().op("text_ops"),
    ),
    index("idx_articles_workspace_updated_at").using(
      "btree",
      table.workspaceId.asc().nullsLast().op("timestamptz_ops"),
      table.updatedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    uniqueIndex("uq_articles_integration_doc").using(
      "btree",
      table.integrationId.asc().nullsLast().op("int8_ops"),
      table.sourceDocToken.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "articles_workspace_id_workspaces_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.integrationId],
      foreignColumns: [integrations.id],
      name: "articles_integration_id_integrations_id_fk",
    }).onDelete("cascade"),
    check("articles_status_check", sql`status = ANY (ARRAY['draft'::text, 'ready'::text, 'published'::text, 'archived'::text])`),
  ],
);

export const assets = pgTable(
  "assets",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ name: "assets_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    workspaceId: bigint("workspace_id", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    articleId: bigint("article_id", { mode: "number" }),
    type: text().default("image").notNull(),
    sourceUrl: text("source_url"),
    sourceKey: text("source_key"),
    mime: text(),
    sha256: text(),
    ossBucket: text("oss_bucket"),
    ossKey: text("oss_key"),
    ossUrl: text("oss_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_assets_article_id").using("btree", table.articleId.asc().nullsLast().op("int8_ops")),
    index("idx_assets_workspace_article_id").using(
      "btree",
      table.workspaceId.asc().nullsLast().op("int8_ops"),
      table.articleId.asc().nullsLast().op("int8_ops"),
    ),
    uniqueIndex("uq_assets_sha256").using("btree", table.sha256.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.articleId],
      foreignColumns: [articles.id],
      name: "assets_article_id_articles_id_fk",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "assets_workspace_id_workspaces_id_fk",
    }).onDelete("cascade"),
    check("assets_type_check", sql`type = ANY (ARRAY['image'::text, 'file'::text])`),
  ],
);

export const articlePublications = pgTable(
  "article_publications",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "article_publications_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 9223372036854775807,
        cache: 1,
      }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    articleId: bigint("article_id", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    integrationId: bigint("integration_id", { mode: "number" }).notNull(),
    status: text().default("draft").notNull(),
    remoteId: text("remote_id"),
    remoteUrl: text("remote_url"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_article_publications_article_updated_at").using(
      "btree",
      table.articleId.asc().nullsLast().op("int8_ops"),
      table.updatedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    uniqueIndex("uq_article_publications_article_integration").using(
      "btree",
      table.articleId.asc().nullsLast().op("int8_ops"),
      table.integrationId.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.articleId],
      foreignColumns: [articles.id],
      name: "article_publications_article_id_articles_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.integrationId],
      foreignColumns: [integrations.id],
      name: "article_publications_integration_id_integrations_id_fk",
    }).onDelete("cascade"),
    check(
      "article_publications_status_check",
      sql`status = ANY (ARRAY['draft'::text, 'publishing'::text, 'published'::text, 'failed'::text, 'archived'::text])`,
    ),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    workspaceId: bigint("workspace_id", { mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    userId: bigint("user_id", { mode: "number" }).notNull(),
    role: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_workspace_members_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "workspace_members_workspace_id_workspaces_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "workspace_members_user_id_users_id_fk",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.workspaceId, table.userId], name: "workspace_members_pk" }),
    check("workspace_members_role_check", sql`role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])`),
  ],
);

export const workspaceSettings = pgTable(
  "workspace_settings",
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    workspaceId: bigint("workspace_id", { mode: "number" }).notNull(),
    key: text().notNull(),
    value: jsonb().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_workspace_settings_workspace_id").using("btree", table.workspaceId.asc().nullsLast().op("int8_ops")),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
      name: "workspace_settings_workspace_id_workspaces_id_fk",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.workspaceId, table.key], name: "workspace_settings_pk" }),
  ],
);
