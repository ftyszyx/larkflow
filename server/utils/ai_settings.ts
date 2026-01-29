import { and, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { workspaceSettings } from "../drizzle/schema.ts";

export type WorkspaceAiSettingsValue = {
  grsChat?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  nanoBanana?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    imageSize?: "1K" | "2K" | "4K";
    aspectRatio?: string;
  };
};

export type ResolvedAiConfig = {
  grsChat: {
    apiKey: string | null;
    baseUrl: string;
    model: string;
  };
  nanoBanana: {
    apiKey: string | null;
    baseUrl: string;
    model: string;
    imageSize: "1K" | "2K" | "4K";
    aspectRatio: string;
  };
};

const AI_KEY = "ai";

const getEnv = (key: string) => {
  const v = Deno.env.get(key);
  return v && v.trim() ? v.trim() : null;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
};

export const parseWorkspaceAiSettings = (value: unknown): WorkspaceAiSettingsValue | null => {
  if (!isObjectRecord(value)) return null;

  const grsChatRaw = value.grsChat;
  const nanoRaw = value.nanoBanana;

  const out: WorkspaceAiSettingsValue = {};

  if (isObjectRecord(grsChatRaw)) {
    out.grsChat = {
      apiKey: normalizeString(grsChatRaw.apiKey) ?? undefined,
      baseUrl: normalizeString(grsChatRaw.baseUrl) ?? undefined,
      model: normalizeString(grsChatRaw.model) ?? undefined,
    };
  }

  if (isObjectRecord(nanoRaw)) {
    const imageSize = normalizeString(nanoRaw.imageSize);
    out.nanoBanana = {
      apiKey: normalizeString(nanoRaw.apiKey) ?? undefined,
      baseUrl: normalizeString(nanoRaw.baseUrl) ?? undefined,
      model: normalizeString(nanoRaw.model) ?? undefined,
      imageSize: (imageSize === "1K" || imageSize === "2K" || imageSize === "4K") ? imageSize : undefined,
      aspectRatio: normalizeString(nanoRaw.aspectRatio) ?? undefined,
    };
  }

  return out;
};

export const loadWorkspaceAiSettingsValue = async (workspaceId: number): Promise<WorkspaceAiSettingsValue | null> => {
  const rows = await db
    .select({ value: workspaceSettings.value })
    .from(workspaceSettings)
    .where(and(eq(workspaceSettings.workspaceId, workspaceId), eq(workspaceSettings.key, AI_KEY)))
    .limit(1);

  const raw = rows[0]?.value;
  if (!raw) return null;
  return parseWorkspaceAiSettings(raw);
};

export const resolveAiConfig = (value: WorkspaceAiSettingsValue | null): ResolvedAiConfig => {
  const chatApiKey = value?.grsChat?.apiKey ?? getEnv("GRS_AI_API_KEY");
  const chatBaseUrl = value?.grsChat?.baseUrl ?? getEnv("GRS_AI_BASE_URL") ?? "https://grsaiapi.com";
  const chatModel = value?.grsChat?.model ?? getEnv("GRS_AI_CHAT_MODEL") ?? "gemini-3-pro";

  const nanoApiKey = value?.nanoBanana?.apiKey ?? getEnv("GRS_NANO_BANANA_API_KEY") ?? getEnv("GRS_AI_API_KEY");
  const nanoBaseUrl = value?.nanoBanana?.baseUrl ?? getEnv("GRS_NANO_BANANA_BASE_URL") ?? "https://grsai.dakka.com.cn";
  const nanoModel = value?.nanoBanana?.model ?? getEnv("GRS_NANO_BANANA_MODEL") ?? "nano-banana-fast";
  const nanoImageSize = value?.nanoBanana?.imageSize ?? ((getEnv("GRS_NANO_BANANA_IMAGE_SIZE") as "1K" | "2K" | "4K" | null) ?? "1K");
  const nanoAspectRatio = value?.nanoBanana?.aspectRatio ?? getEnv("GRS_NANO_BANANA_ASPECT_RATIO") ?? "auto";

  return {
    grsChat: {
      apiKey: chatApiKey,
      baseUrl: chatBaseUrl,
      model: chatModel,
    },
    nanoBanana: {
      apiKey: nanoApiKey,
      baseUrl: nanoBaseUrl,
      model: nanoModel,
      imageSize: nanoImageSize,
      aspectRatio: nanoAspectRatio,
    },
  };
};

export const loadResolvedWorkspaceAiConfig = async (workspaceId: number): Promise<ResolvedAiConfig> => {
  const value = await loadWorkspaceAiSettingsValue(workspaceId);
  return resolveAiConfig(value);
};
