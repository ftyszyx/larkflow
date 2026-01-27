import { MarkdownRenderer } from './feishu_docx/index.ts';
import { Buffer } from "node:buffer";
import { Block, DocMetaInfo, CommonBlock } from './feishu_docx/types.ts';
import { FeishuDocInfo, FeishuResp, FieshuTenantTokenResponse, FeishuBlockInfo } from './type.ts';
// import * as lark from '@larksuiteoapi/node-sdk';
export function docxBlocksToMarkdown(
  input: { document: { document_id: string }; blocks: Block[] }): {
    markdown: string; fileTokens: Record<string, CommonBlock>; meta: DocMetaInfo;
  } {
  const render = new MarkdownRenderer(input)
  const content = render.parse()
  return { markdown: content, fileTokens: render.fileTokens, meta: render.meta };
}


export class FeishuClient {
  appid: string;
  appSecret: string;
  baseUrl: string;
  tenantAccessToken: string;
  constructor(appid: string, appSecret: string) {
    this.appid = appid;
    this.appSecret = appSecret;
    this.baseUrl = "https://open.feishu.cn";
    this.tenantAccessToken = "";
  }

  async init() {
    await this.getAccessToken();
  }

  async getAccessToken() {
    const url = new URL("/open-apis/auth/v3/tenant_access_token/internal", this.baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ app_id: this.appid, app_secret: this.appSecret }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Feishu token error ${res.status}: ${text}`);

    const data = JSON.parse(text) as FieshuTenantTokenResponse;
    const token = String(data.tenant_access_token ?? "").trim();
    if (!token) throw new Error(`Feishu token missing: ${data.msg ?? "unknown"}`);
    this.tenantAccessToken = token;
  };

  async request<T>(path: string, query?: Record<string, string | number>): Promise<T | undefined> {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.tenantAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Feishu API error ${res.status}: ${text}`);
    }

    try {
      const result = JSON.parse(text) as FeishuResp<T>;
      if (result.code && result.code == 99991663) {
        await this.getAccessToken();
        return this.request(path, query);
      }
      return result.data;
    } catch (err: any) {
      throw new Error(`Feishu API error ${res.status}: ${err.message} \n ${text}`);
    }
  };


  async getWikiDocInfo(docToken: string): Promise<FeishuDocInfo> {
    const res = await this.request<FeishuDocInfo>(`/open-apis/docx/v1/documents/${docToken}`);
    if (!res) throw new Error(`Feishu API error: ${docToken}`);
    return res;
  }

  async getWikiAllBlocks(docToken: string): Promise<Block[]> {
    const all: Block[] = [];
    let pageToken = "";
    let hasMore = true;
    while (hasMore) {
      const res = await this.request<FeishuBlockInfo>(`/open-apis/docx/v1/documents/${docToken}/blocks`, {
        page_size: 500,
        page_token: pageToken,
        document_revision_id: -1,
        user_id_type: "open_id",
      });

      const items = res?.items ?? [];
      all.push(...(items as Block[]));

      hasMore = !!res?.has_more;
      pageToken = res?.page_token ?? "";
      if (!pageToken && hasMore) hasMore = false;
    }
    return all;
  };

  async getWikiNodeInfo(nodeToken: string): Promise<FeishuDocInfo> {
    const res = await this.request<FeishuDocInfo>(`/open-apis/wiki/v2/spaces/get_node`, {
      token: nodeToken,
      obj_type: "wiki",
    });
    if (!res) throw new Error(`Feishu API error: ${nodeToken}`);
    return res;
  }

  async downloadFeishuMedia(fileToken: string): Promise<Buffer> {
    const url = new URL(`/open-apis/drive/v1/medias/${fileToken}/download`, this.baseUrl);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.tenantAccessToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Feishu media download error ${res.status}: ${text}`);
    }

    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}

const clientCache = new Map<string, FeishuClient>();

export const getFeishuClient = async (appid: string, appSecret: string): Promise<FeishuClient> => {
  const cached = clientCache.get(appid);
  if (cached) {
    return cached;
  }
  const client = new FeishuClient(appid, appSecret);
  await client.init();
  clientCache.set(appid, client)
  return client;
}

