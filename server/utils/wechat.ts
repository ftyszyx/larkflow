//https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add.html
import { Buffer } from "node:buffer";

export enum WechatFileType {
    image = "image",
    voice = "voice",
    video = "video",
    thumb = "thumb",
}

export type FileInfo = {
    fileName: string;
    fileSize: number;
    contentType: string;
    fileContent: Buffer;
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

    }


    async getToken() {
        const res = await fetch(`https://${this.baseUrl}/cgi-bin/token?grant_type=client_credential&appid=${this.appid}&secret=${this.appsecret}`);
        const text = await res.text();
        if (!res.ok) throw new Error(`Wechat token error ${res.status}: ${text}`);
        const data = JSON.parse(text) as { access_token: string, expires_in: number, errcode?: number, errmsg?: string };
        if (data.errcode) {
            throw new Error(`Wechat token error ${data.errcode}: ${data.errmsg}`);
        }
        this.access_token = data.access_token;
    }

    async request<T>({ path, query, fetchOptions }: { path: string, query?: Record<string, string | number>, fetchOptions?: RequestInit }): Promise<T | undefined> {
        const url = new URL(`https://${this.baseUrl}/${path}`)
        if (query) {
            for (const [k, v] of Object.entries(query)) {
                url.searchParams.set(k, String(v))
            }
        }
        const res = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${this.access_token}`
            },
            ...fetchOptions
        }) as { errcode?: number, errmsg?: string };
        if (res.errcode && res.errcode === 42001) {
            await this.getToken();
            return this.request({ path, query, fetchOptions });
        }
        if (res.errcode && res.errcode !== 0) {
            throw new Error(`Wechat request error ${res.errcode}: ${res.errmsg}`);
        }
        return res as T;
    }


    async uploadMedia({
        type,
        file,
    }: {
        type: WechatFileType;
        file: FileInfo;
    }) {
        const form = new FormData();
        const bytes = new Uint8Array(file.fileContent);
        const blob = new Blob([bytes], { type: file.contentType });
        form.append("media", blob, file.fileName);
        const res = await this.request<{ media_id: string, url: string }>(
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