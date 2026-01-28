import { marked } from "marked";
import { PlatformType } from "../constants/platform.ts";
import { getWechatClient, wechatArticleType } from "../utils/wechat.ts";
import { PlatformPublisher, type PublishArticleInput, type PublishArticleResult } from "./platform_publisher.ts";

type WechatMpConfig = {
  appId?: string;
  appSecret?: string;
  author?: string;
  contentSourceUrl?: string;
  thumbMediaId?: string;
};

const parseWechatMpConfig = (cfg: Record<string, unknown>): WechatMpConfig => {
  return {
    appId: typeof cfg.appId === "string" ? cfg.appId : undefined,
    appSecret: typeof cfg.appSecret === "string" ? cfg.appSecret : undefined,
    author: typeof cfg.author === "string" ? cfg.author : undefined,
    contentSourceUrl: typeof cfg.contentSourceUrl === "string" ? cfg.contentSourceUrl : undefined,
    thumbMediaId: typeof cfg.thumbMediaId === "string" ? cfg.thumbMediaId : undefined,
  };
};

export class WechatMpPublisher extends PlatformPublisher {
  readonly platformType = PlatformType.WechatMp;

  async publish(input: PublishArticleInput): Promise<PublishArticleResult> {
    const cfg = parseWechatMpConfig(input.integration.config);
    const appId = String(cfg.appId ?? "").trim();
    const appSecret = String(cfg.appSecret ?? "").trim();
    const thumbMediaId = String(cfg.thumbMediaId ?? "").trim();
    if (!appId || !appSecret) throw new Error("missing integrations.config.appId/appSecret");
    if (!thumbMediaId) throw new Error("missing integrations.config.thumbMediaId");

    const client = await getWechatClient(appId, appSecret);

    const html = marked.parse(input.article.contentMdFinal ?? "", { gfm: true, breaks: true }) as string;
    const res = await client.addDraft({
      articles: {
        article_type: wechatArticleType.news,
        title: input.article.title,
        author: (cfg.author ?? "").trim(),
        content: html,
        content_source_url: (cfg.contentSourceUrl ?? "").trim(),
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
        image_info: { image_list: [] },
      },
    });

    return { remoteId: res.media_id };
  }
}
