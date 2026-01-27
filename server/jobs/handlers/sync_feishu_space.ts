import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db.ts";
import { articles, feishuSpaceSyncs, integrations } from "../../drizzle/schema.ts";
import { JobQueue } from "../../constants/jobs.ts";
import { docxBlocksToMarkdown } from "../../utils/feishu/index.ts";
import { CommonBlock, FileBlock } from "../../utils/feishu/feishu_docx/index.ts";
import { checkObjectExists, putObject, getFileUrl } from "../../utils/oss.ts";
import { applyUrlMappings } from "../../utils/markdown_replace.ts";
import { ArticleStatus } from "../../constants/articles.ts";
import { FeishuClient, getFeishuClient } from "../../utils/feishu/index.ts";

type SyncFeishuSpacePayload = {
  type: JobQueue.SyncFeishuSpace;
  integrationId: number;
  workspaceId: number;
  docToken: string;
};

type FeishuAccessInfo = {
  tenantAccessToken: string;
  baseUrl: string;
};

type IntegrationConfig = {
  baseUrl?: string;
  appId?: string;
  appSecret?: string;
};


const parseIntegrationConfig = (value: unknown): IntegrationConfig => {
  if (!value || typeof value !== "object") return {};
  const cfg = value as Record<string, unknown>;
  return {
    baseUrl: typeof cfg.baseUrl === "string" ? cfg.baseUrl : undefined,
    appId: typeof cfg.appId === "string" ? cfg.appId : undefined,
    appSecret: typeof cfg.appSecret === "string" ? cfg.appSecret : undefined,
  };
};





export function getFileNameFromBlock(block: CommonBlock): string {
  if (block.type === 'image') {
    return `${block.block.token}.png`;
  }
  if (block.type === 'file') {
    const fileblock = block.block as FileBlock;
    return `${block.block.token}_${fileblock.name}`;
  }
  return '';
}


export const uploadFileToOSS = async (workspaceId: number, client: FeishuClient, token: string, filename: string): Promise<{ token: string, url: string }> => {
  const fileExit = await checkObjectExists(workspaceId, filename);
  if (fileExit) {
    const fileurl = await getFileUrl(workspaceId, filename);
    return { token, url: fileurl };
  }
  const downres = await client.downloadFeishuMedia(token);
  const result = await putObject(workspaceId, filename, downres);
  if (!result.url) {
    throw new Error("Failed to upload file to OSS");
  }
  return { token, url: result.url };
};

export const handleSyncFeishuSpace = async (payload: SyncFeishuSpacePayload) => {
  const integrationId = Number(payload.integrationId);
  const docToken = String(payload.docToken ?? "").trim();
  if (!Number.isFinite(integrationId)) throw new Error("invalid integrationId");
  if (!docToken) throw new Error("missing docToken");
  const integrationRows = await db
    .select({
      id: integrations.id,
      workspaceId: integrations.workspaceId,
      config: integrations.config,
    })
    .from(integrations)
    .where(eq(integrations.id, integrationId));
  if (integrationRows.length === 0) throw new Error("integration not found");
  const integration = integrationRows[0];

  await db
    .insert(feishuSpaceSyncs)
    .values({
      integrationId,
      docToken,
      status: "syncing",
      lastError: null,
    })
    .onConflictDoUpdate({
      target: [feishuSpaceSyncs.integrationId, feishuSpaceSyncs.docToken],
      set: {
        status: "syncing",
        lastError: null,
        updatedAt: sql`now()`,
      },
    });

  try {
    const cfg = parseIntegrationConfig(integration.config);
    const appId = String(cfg.appId ?? "").trim();
    const appSecret = String(cfg.appSecret ?? "").trim();
    if (!appId || !appSecret) throw new Error("missing integrations.config.appId/appSecret");

    const client = await getFeishuClient(appId, appSecret);
    const document = await client.getWikiDocInfo(docToken);
    const blocks = await client.getWikiAllBlocks(docToken);
    const res = docxBlocksToMarkdown({ document: { document_id: docToken }, blocks });
    const markdown = res.markdown;
    const title = (document?.title && String(document.title).trim()) ? String(document.title).trim() : docToken;
    const cover_Token = document?.cover?.token;
    //download all files
    const urlMappings: { from: string; to: string }[] = [];
    for (const fileBlock of Object.values(res.fileTokens)) {
      //TODO: download file
      const filename = getFileNameFromBlock(fileBlock);
      const ossObjectKey = `feishu-docx/${docToken}/${filename}`;
      const res = await uploadFileToOSS(integration.workspaceId, client, fileBlock.block.token, ossObjectKey);
      urlMappings.push({
        from: fileBlock.block.token,
        to: res.url,
      });
    }
    const markdownWithUrls = applyUrlMappings(markdown, urlMappings);
    let cover_url = ""
    let cover_token = ""
    if (cover_Token) {
      const ossObjectKey = `feishu-docx/${docToken}/${cover_Token}.png`;
      const res = await uploadFileToOSS(integration.workspaceId, client, cover_Token, ossObjectKey);
      cover_url = res.url;
      cover_token = cover_Token;
    }

    const articleRows = await db
      .insert(articles)
      .values({
        workspaceId: integration.workspaceId,
        integrationId,
        sourceDocToken: docToken,
        sourceUpdatedAt: null,
        title,
        coverUrl: cover_url,
        contentMd: markdown,
        contentMdFinal: markdownWithUrls,
        status: ArticleStatus.Draft,
      })
      .onConflictDoUpdate({
        target: [articles.integrationId, articles.sourceDocToken],
        set: {
          title,
          contentMd: markdown,
          contentMdFinal: markdown,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: articles.id });

    void articleRows[0].id;

    await db
      .update(feishuSpaceSyncs)
      .set({
        status: "idle",
        lastSyncedAt: sql`now()`,
        lastError: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(feishuSpaceSyncs.integrationId, integrationId), eq(feishuSpaceSyncs.docToken, docToken)));

    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .update(feishuSpaceSyncs)
      .set({
        status: "failed",
        lastError: message,
        updatedAt: sql`now()`,
      })
      .where(and(eq(feishuSpaceSyncs.integrationId, integrationId), eq(feishuSpaceSyncs.docToken, docToken)));

    throw e;
  }
};

