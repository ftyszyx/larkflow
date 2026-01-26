export enum PlatformType {
    Feishu = 1,
    WechatMp = 2,
}

export type BaseIntegrationConfig = {
    baseUrl?: string;
    appId?: string;
    appSecret?: string;
};

export type WechatMpIntegrationConfig = BaseIntegrationConfig;

export type FeishuIntegrationConfig = BaseIntegrationConfig & {
    workspaceId?: string;
};

export type IntegrationConfig = WechatMpIntegrationConfig | FeishuIntegrationConfig;

export const isPlatformType = (value: unknown): value is PlatformType => {
    return value === PlatformType.Feishu || value === PlatformType.WechatMp;
};

export const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
    return !!value && typeof value === "object" && !Array.isArray(value);
};
