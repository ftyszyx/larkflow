import { relations } from "drizzle-orm/relations";
import { workspaces, workspaceInvitations, users, integrations, feishuSpaceSyncs, articles, assets, articlePublications, workspaceMembers } from "./schema";

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({one}) => ({
	workspace: one(workspaces, {
		fields: [workspaceInvitations.workspaceId],
		references: [workspaces.id]
	}),
	user: one(users, {
		fields: [workspaceInvitations.createdByUserId],
		references: [users.id]
	}),
}));

export const workspacesRelations = relations(workspaces, ({many}) => ({
	workspaceInvitations: many(workspaceInvitations),
	integrations: many(integrations),
	articles: many(articles),
	assets: many(assets),
	articlePublications: many(articlePublications),
	workspaceMembers: many(workspaceMembers),
}));

export const usersRelations = relations(users, ({many}) => ({
	workspaceInvitations: many(workspaceInvitations),
	workspaceMembers: many(workspaceMembers),
}));

export const integrationsRelations = relations(integrations, ({one, many}) => ({
	workspace: one(workspaces, {
		fields: [integrations.workspaceId],
		references: [workspaces.id]
	}),
	feishuSpaceSyncs: many(feishuSpaceSyncs),
	articles: many(articles),
	articlePublications: many(articlePublications),
}));

export const feishuSpaceSyncsRelations = relations(feishuSpaceSyncs, ({one}) => ({
	integration: one(integrations, {
		fields: [feishuSpaceSyncs.integrationId],
		references: [integrations.id]
	}),
}));

export const articlesRelations = relations(articles, ({one, many}) => ({
	workspace: one(workspaces, {
		fields: [articles.workspaceId],
		references: [workspaces.id]
	}),
	integration: one(integrations, {
		fields: [articles.integrationId],
		references: [integrations.id]
	}),
	assets: many(assets),
	articlePublications: many(articlePublications),
}));

export const assetsRelations = relations(assets, ({one}) => ({
	article: one(articles, {
		fields: [assets.articleId],
		references: [articles.id]
	}),
	workspace: one(workspaces, {
		fields: [assets.workspaceId],
		references: [workspaces.id]
	}),
}));

export const articlePublicationsRelations = relations(articlePublications, ({one}) => ({
	workspace: one(workspaces, {
		fields: [articlePublications.workspaceId],
		references: [workspaces.id]
	}),
	article: one(articles, {
		fields: [articlePublications.articleId],
		references: [articles.id]
	}),
	integration: one(integrations, {
		fields: [articlePublications.integrationId],
		references: [integrations.id]
	}),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({one}) => ({
	workspace: one(workspaces, {
		fields: [workspaceMembers.workspaceId],
		references: [workspaces.id]
	}),
	user: one(users, {
		fields: [workspaceMembers.userId],
		references: [users.id]
	}),
}));