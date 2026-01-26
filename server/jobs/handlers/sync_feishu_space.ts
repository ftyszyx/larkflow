import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db.ts";
import { articles, feishuSpaceSyncs, integrations } from "../../drizzle/schema.ts";
import { JobQueue } from "../../constants/jobs.ts";
import { docxBlocksToMarkdown } from "../../utils/feishu/index.ts";
import { Block, CommonBlock, FileBlock } from "../../utils/feishu/feishu_docx/index.ts";
import { Buffer } from "node:buffer";
import { checkObjectExists, putObject, getFileUrl } from "../../utils/oss.ts";
import { applyUrlMappings } from "../../utils/markdown_replace.ts";
import { ArticleStatus } from "../../constants/articles.ts";

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


type FeiShuResp<T = unknown> = {
  code: number;
  msg: string;
  data?: T;
}

type FeishuDocInfo = {
  cover: {
    token: string;
  };
  document_id?: string;
  title?: string;
  revision_id?: number;
}


type FeishuDocxBlocksResponse = {
  data?: {
    items?: unknown[];
    has_more?: boolean;
    page_token?: string;
  };
};

type FeishuTenantTokenResponse = {
  code?: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
};

type IntegrationConfig = {
  baseUrl?: string;
  appId?: string;
  appSecret?: string;
};

type FeishuWikiNodeInfo = {
  creator: string;
  has_child: boolean;
  node_create_time: number;
  node_creator: string;
  node_token: string;//节点的 token
  node_type: string;//节点的类型
  obj_create_time: number;//节点的实际云文档的创建时间
  obj_edit_time: number;//节点的实际云文档的编辑时间
  obj_token: string;//节点的实际云文档的 token
  obj_type: string;//节点的实际云文档的类型
  space_id: string;
  title: string;
  owner: string;
}

const parseIntegrationConfig = (value: unknown): IntegrationConfig => {
  if (!value || typeof value !== "object") return {};
  const cfg = value as Record<string, unknown>;
  return {
    baseUrl: typeof cfg.baseUrl === "string" ? cfg.baseUrl : undefined,
    appId: typeof cfg.appId === "string" ? cfg.appId : undefined,
    appSecret: typeof cfg.appSecret === "string" ? cfg.appSecret : undefined,
  };
};

const getFeishuTenantAccessToken = async (baseUrl: string, appId: string, appSecret: string): Promise<FeishuAccessInfo> => {
  const url = new URL("/open-apis/auth/v3/tenant_access_token/internal", baseUrl);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Feishu token error ${res.status}: ${text}`);

  const data = JSON.parse(text) as FeishuTenantTokenResponse;
  const token = String(data.tenant_access_token ?? "").trim();
  if (!token) throw new Error(`Feishu token missing: ${data.msg ?? "unknown"}`);
  return {
    tenantAccessToken: token,
    baseUrl: baseUrl,
  };
};

const feishuRequest = async <T>(accessinfo: FeishuAccessInfo, path: string, query?: Record<string, string | number>) => {
  const url = new URL(path, accessinfo.baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessinfo.tenantAccessToken}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Feishu API error ${res.status}: ${text}`);
  }

  return JSON.parse(text) as T;
};

const getDocumentInfo = async (accessinfo: FeishuAccessInfo, docToken: string): Promise<FeishuDocInfo> => {
  const res = await feishuRequest<FeiShuResp<{ document: FeishuDocInfo }>>(accessinfo, `/open-apis/docx/v1/documents/${docToken}`);
  return res?.data?.document ?? {} as FeishuDocInfo;
};


const getNodeInfo = async (accessinfo: FeishuAccessInfo, nodeToken: string): Promise<FeishuWikiNodeInfo> => {
  const res = await feishuRequest<FeiShuResp<{ node: FeishuWikiNodeInfo }>>(accessinfo, `/open-apis/docx/v1/nodes/${nodeToken}`);
  return res?.data?.node ?? {} as FeishuWikiNodeInfo;
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

export async function downloadFeishuMedia(accessinfo: FeishuAccessInfo, fileToken: string): Promise<Buffer> {
  const res = (await feishuRequest(accessinfo, `/open-apis/drive/v1/medias/${fileToken}/download`, {
    json: false,
    encoding: null as any,
  } as any)) as any;

  if (Buffer.isBuffer(res)) return res;
  if (typeof res === 'string') return Buffer.from(res, 'binary');
  return Buffer.from(res || '');
}



const getAllBlocks = async (accessinfo: FeishuAccessInfo, docToken: string): Promise<Block[]> => {
  const all: Block[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const res = await feishuRequest<FeishuDocxBlocksResponse>(accessinfo, `/open-apis/docx/v1/documents/${docToken}/blocks`, {
      page_size: 500,
      page_token: pageToken,
      document_revision_id: -1,
      user_id_type: "open_id",
    });

    const items = res?.data?.items ?? [];
    all.push(...(items as Block[]));

    hasMore = !!res?.data?.has_more;
    pageToken = res?.data?.page_token ?? "";

    if (!pageToken && hasMore) hasMore = false;
  }

  return all;
};

export const uploadFileToOSS = async (workspaceId: number, accessinfo: FeishuAccessInfo, token: string, filename: string): Promise<{ token: string, url: string }> => {
  const fileExit = await checkObjectExists(workspaceId, filename);
  if (fileExit) {
    const fileurl = await getFileUrl(workspaceId, filename);
    return { token, url: fileurl };
  }
  const downres = await downloadFeishuMedia(accessinfo, token);
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
    const baseUrl = (cfg.baseUrl ?? "https://open.feishu.cn").trim();
    const appId = String(cfg.appId ?? "").trim();
    const appSecret = String(cfg.appSecret ?? "").trim();
    if (!appId || !appSecret) throw new Error("missing integrations.config.appId/appSecret");

    const accessInfo = await getFeishuTenantAccessToken(baseUrl, appId, appSecret);

    const document = await getDocumentInfo(accessInfo, docToken);
    const blocks = await getAllBlocks(accessInfo, docToken);
    const res = docxBlocksToMarkdown({ document: { document_id: docToken }, blocks });
    const nodeInfo = await getNodeInfo(accessInfo, docToken);
    const markdown = res.markdown;
    const title = (document?.title && String(document.title).trim()) ? String(document.title).trim() : docToken;
    const cover_Token = document?.cover?.token;
    //download all files
    const urlMappings: { from: string; to: string }[] = [];
    for (const fileBlock of Object.values(res.fileTokens)) {
      //TODO: download file
      const filename = getFileNameFromBlock(fileBlock);
      const ossObjectKey = `feishu-docx/${docToken}/${filename}`;
      const res = await uploadFileToOSS(integration.workspaceId, accessInfo, fileBlock.block.token, ossObjectKey);
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
      const res = await uploadFileToOSS(integration.workspaceId, accessInfo, cover_Token, ossObjectKey);
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

