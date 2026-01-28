//https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add.html
import { Buffer } from "node:buffer";

export enum WechatFileType {
    image = "image",
    voice = "voice",
    video = "video",
    thumb = "thumb",
}

export enum wechatArticleType {
    news = "news",//图文
    newspic = "newspic" //图片
}

export type FileInfo = {
    fileName: string;
    fileSize: number;
    contentType: string;
    fileContent: Buffer;
}

export type WechatDraftAddRequest = {
    articles: {
        article_type: wechatArticleType,
        title: string,
        author: string,
        digest?: string,//摘要
        content: string,//内容
        content_source_url: string,//源文地址
        thumb_media_id: string, //封面meida id
        need_open_comment: number,//是否打开评论
        only_fans_can_comment: number,//是否粉丝才可见
        image_info: {  //图片信息
            image_list: string[]
        }
    };
}

export type WechatDraftAddResponse = {
    media_id: string;
}

export type WechatDraftUpdateRequest = {
    media_id: string;
    index: number;
    articles: WechatDraftAddRequest["articles"];
}

export type WechatDraftUpdateResponse = {
    errcode: number;
    errmsg: string;
}

export type WechatUploadTempMediaResponse = {
    type: WechatFileType;
    media_id: string;
    created_at: number;
}

export class WechatClient {
    appid: string;
    appsecret: string;
    baseUrl: string;
    access_token: string;
    constructor(appid: string, appsecret: string) {
        this.appid = appid;
        this.appsecret = appsecret;
        this.baseUrl = "api.weixin.qq.com";
        this.access_token = "";
    }

    async init() {
        await this.getToken();
    }


    async getToken() {
        const res = await fetch(`https://${this.baseUrl}/cgi-bin/token?grant_type=client_credential&appid=${this.appid}&secret=${this.appsecret}`);
        const text = await res.text();
        if (!res.ok) throw new Error(`Wechat token error ${res.status}: ${text}`);
        let data: unknown = text;
        try {
            data = text ? JSON.parse(text) : undefined;
        } catch {
            data = text;
        }

        if (data && typeof data === "object") {
            const maybeErr = data as { errcode?: number, errmsg?: string };
            if (maybeErr.errcode) {
                throw new Error(`Wechat token error ${maybeErr.errcode}: ${maybeErr.errmsg}`);
            }
        }
        const tokenData = data as { access_token: string, expires_in: number };
        this.access_token = tokenData.access_token;
    }

    async request<T>({ path, query, fetchOptions }: { path: string, query?: Record<string, string | number>, fetchOptions?: RequestInit }): Promise<T> {
        const url = new URL(`https://${this.baseUrl}/${path}`);
        url.searchParams.set("access_token", this.access_token);
        if (query) {
            for (const [k, v] of Object.entries(query)) {
                url.searchParams.set(k, String(v));
            }
        }

        const res = await fetch(url.toString(), {
            ...fetchOptions,
            headers: {
                ...(fetchOptions?.headers ?? {}),
            },
        });

        const text = await res.text();
        if (!res.ok) throw new Error(`Wechat request error ${res.status}: ${text}`);

        let data: unknown = text;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = text;
        }

        if (data && typeof data === "object") {
            const maybeErr = data as { errcode?: number; errmsg?: string };
            if (maybeErr.errcode && maybeErr.errcode === 42001) {
                await this.getToken();
                return this.request({ path, query, fetchOptions });
            }
            if (maybeErr.errcode && maybeErr.errcode !== 0) {
                throw new Error(`Wechat request error ${maybeErr.errcode}: ${maybeErr.errmsg}`);
            }
        }

        return data as T;
    }


    async uploadMedia({
        type,
        file,
    }: {
        type: WechatFileType;
        file: FileInfo;
    }): Promise<WechatUploadTempMediaResponse> {

        const form = new FormData();
        const bytes = new Uint8Array(file.fileContent);
        const blob = new Blob([bytes], { type: file.contentType });
        form.append("media", blob, file.fileName);
        const res = await this.request<WechatUploadTempMediaResponse>(
            {
                path: "/cgi-bin/media/upload",
                query: {
                    type
                },

                fetchOptions: {
                    method: "POST",
                    body: form,
                }
            });
        return res;
    }

    uploadTempMedia(payload: { type: WechatFileType; file: FileInfo }): Promise<WechatUploadTempMediaResponse> {
        return this.uploadMedia(payload);
    }


    async addDraft(payload: WechatDraftAddRequest) {
        const res = await this.request<WechatDraftAddResponse>({
            path: "/cgi-bin/draft/add",
            fetchOptions: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            },
        });
        return res;
    }

    async updateDraft(payload: WechatDraftUpdateRequest) {
        const res = await this.request<WechatDraftUpdateResponse>({
            path: "/cgi-bin/draft/update",
            fetchOptions: {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            },
        });
        return res;
    }
}

const clientCache = new Map<string, WechatClient>();
export const getWechatClient = async (appid: string, appsecret: string) => {
    const cache = clientCache.get(appid)
    if (cache)
        return cache
    const client = new WechatClient(appid, appsecret)
    await client.init()
    clientCache.set(appid, client)
    return client
}   