import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db.ts";
import { assets, articles, feishuSpaceSyncs, integrations } from "../../drizzle/schema.ts";
import { applyUrlMappings } from "../../utils/markdown_replace.ts";
import { putObject } from "../../utils/oss.ts";
import { sha256Hex } from "../../utils/sha256.ts";
import { docxBlocksToMarkdown } from "../../../n8n-feishu/nodes/help/utils/DocxMarkdownRenderer.ts";
import type { Block, CommonBlock, FileBlock } from "../../../n8n-feishu/nodes/help/utils/feishu_docx/types.ts";

type SyncFeishuSpacePayload = {
  type: "sync_feishu_space";
  integrationId: number;
  workspaceId?: number;
  docToken: string;
};

type FeishuDocxDocumentInfoResponse = {
  data?: {
    document?: {
      document_id?: string;
      title?: string;
      revision_id?: number;
    };
  };
};

type FeishuDocxBlocksResponse = {
  data?: {
    items?: Block[];
    has_more?: boolean;
    page_token?: string;
  };
};

const FEISHU_OPEN_BASE_URL = "https://open.feishu.cn";

const feishuRequest = async <T>(accessToken: string, path: string, query?: Record<string, string | number>) => {
  const url = new URL(path, FEISHU_OPEN_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Feishu API error ${res.status}: ${text}`);
  }

  return JSON.parse(text) as T;
};

const getDocumentInfo = async (accessToken: string, docToken: string) => {
  const res = await feishuRequest<FeishuDocxDocumentInfoResponse>(
    accessToken,
    `/open-apis/docx/v1/documents/${docToken}`,
  );
  return res?.data?.document ?? {};
};

const getAllBlocks = async (accessToken: string, docToken: string) => {
  const all: Block[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const res = await feishuRequest<FeishuDocxBlocksResponse>(
      accessToken,
      `/open-apis/docx/v1/documents/${docToken}/blocks`,
      {
        page_size: 500,
        page_token: pageToken,
        document_revision_id: -1,
        user_id_type: "open_id",
      },
    );

    const items = res?.data?.items ?? [];
    all.push(...items);

    hasMore = !!res?.data?.has_more;
    pageToken = res?.data?.page_token ?? "";

    if (!pageToken && hasMore) hasMore = false;
  }

  return all;
};

const getFileNameFromBlock = (block: CommonBlock): string => {
  if (block.type === "image") {
    return `${block.block.token}.png`;
  }
  if (block.type === "file") {
    const fileBlock = block.block as FileBlock;
    return `${block.block.token}_${fileBlock.name}`;
  }
  return "";
};

const downloadFeishuMedia = async (accessToken: string, fileToken: string): Promise<Uint8Array> => {
  const url = new URL(`/open-apis/drive/v1/medias/${fileToken}/download`, FEISHU_OPEN_BASE_URL);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Feishu media download error ${res.status}: ${text}`);
  }
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
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
      accessToken: integrations.accessToken,
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
    const accessToken = String(integration.accessToken ?? "").trim();
    if (!accessToken) throw new Error("missing integration.accessToken");

    const document = await getDocumentInfo(accessToken, docToken);
    const blocks = await getAllBlocks(accessToken, docToken);

    const title = (document?.title && String(document.title).trim()) ? String(document.title).trim() : docToken;

    const rendered = docxBlocksToMarkdown({ document: { document_id: docToken }, blocks });
    const markdown = rendered?.markdown ?? "";
    const fileTokens = rendered?.fileTokens ?? {};

    const articleRows = await db
      .insert(articles)
      .values({
        workspaceId: integration.workspaceId,
        integrationId,
        sourceDocToken: docToken,
        sourceUpdatedAt: null,
        title,
        contentMd: markdown,
        contentMdFinal: markdown,
        status: "draft",
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

    const articleId = articleRows[0].id;

    const mappings: Array<{ from: string; to: string }> = [];
    for (const common of Object.values(fileTokens)) {
      const token = common.block.token;
      const fileName = getFileNameFromBlock(common);
      if (!token || !fileName) continue;

      const objectKey = `feishu-docx/${docToken}/${fileName}`;
      const buf = await downloadFeishuMedia(accessToken, token);
      const sha256 = await sha256Hex(buf);

      const put = await putObject(objectKey, buf);
      const ossUrl = put.url ?? null;

      await db
        .insert(assets)
        .values({
          workspaceId: integration.workspaceId,
          articleId,
          type: common.type === "file" ? "file" : "image",
          sourceKey: token,
          sha256,
          ossBucket: put.bucket,
          ossKey: put.objectKey,
          ossUrl,
        })
        .onConflictDoNothing();

      if (ossUrl) mappings.push({ from: token, to: ossUrl });
    }

    const replaced = applyUrlMappings(markdown, mappings);
    if (replaced !== markdown) {
      await db
        .update(articles)
        .set({
          contentMdFinal: replaced,
          updatedAt: sql`now()`,
        })
        .where(eq(articles.id, articleId));
    }

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
