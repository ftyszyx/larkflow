import OSS from "ali-oss";

import { and, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { workspaceSettings } from "../drizzle/schema.ts";

export type OssClientConfig = {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint?: string;
};

export type WorkspaceOssConfig = OssClientConfig & {
  publicBaseUrl?: string;
};

const getRequiredString = (obj: Record<string, unknown>, key: string) => {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) throw new Error(`missing ${key}`);
  return v.trim();
};

const parseWorkspaceOssConfig = (value: unknown): WorkspaceOssConfig => {
  if (!value || typeof value !== "object") throw new Error("invalid oss config");
  const obj = value as Record<string, unknown>;

  const region = getRequiredString(obj, "region");
  const accessKeyId = getRequiredString(obj, "accessKeyId");
  const accessKeySecret = getRequiredString(obj, "accessKeySecret");
  const bucket = getRequiredString(obj, "bucket");
  const endpoint = typeof obj.endpoint === "string" && obj.endpoint.trim() ? obj.endpoint.trim() : undefined;
  const publicBaseUrl = typeof obj.publicBaseUrl === "string" && obj.publicBaseUrl.trim() ? obj.publicBaseUrl.trim() : undefined;

  return { region, accessKeyId, accessKeySecret, bucket, endpoint, publicBaseUrl };
};

export const loadWorkspaceOssConfig = async (workspaceId: number): Promise<WorkspaceOssConfig> => {
  const rows = await db
    .select({ key: workspaceSettings.key, value: workspaceSettings.value })
    .from(workspaceSettings)
    .where(and(eq(workspaceSettings.workspaceId, workspaceId), eq(workspaceSettings.key, "aliyun_oss")));
  const row = rows[0];
  if (!row) throw new Error("workspace oss config not found");
  return parseWorkspaceOssConfig(row.value);
};

type WorkspaceOssClient = {
  client: OSS;
  bucket: string;
  publicBaseUrl?: string;
};

const workspaceClientCache = new Map<number, WorkspaceOssClient>();
const workspaceClientInit = new Map<number, Promise<WorkspaceOssClient>>();

export const getWorkspaceOssClient = (workspaceId: number): Promise<WorkspaceOssClient> => {
  const cached = workspaceClientCache.get(workspaceId);
  if (cached) return Promise.resolve(cached);

  const inflight = workspaceClientInit.get(workspaceId);
  if (inflight) return inflight;

  const p = (async () => {
    const cfg = await loadWorkspaceOssConfig(workspaceId);
    const client = new OSS({
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret,
      bucket: cfg.bucket,
      endpoint: cfg.endpoint,
    });
    const result: WorkspaceOssClient = { client, bucket: cfg.bucket, publicBaseUrl: cfg.publicBaseUrl };
    workspaceClientCache.set(workspaceId, result);
    workspaceClientInit.delete(workspaceId);
    return result;
  })();

  workspaceClientInit.set(workspaceId, p);
  return p;
};

export const putObject = async (workspaceId: number, objectKey: string, body: Uint8Array) => {
  const { client, bucket, publicBaseUrl } = await getWorkspaceOssClient(workspaceId);
  const putOptions: any = {};
  putOptions.headers = { 'x-oss-object-acl': 'public-read' };
  await client.put(objectKey, body, putOptions);
  const url = publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${objectKey}` : undefined;
  return { bucket, objectKey, url };
};


export const checkObjectExists = async (workspaceId: number, objectKey: string) => {
  const { client } = await getWorkspaceOssClient(workspaceId);
  try {
    await client.head(objectKey);
    return true;
  } catch {
    return false;
  }
};

export const getFileUrl = async (workspaceId: number, objectKey: string) => {
  const { client } = await getWorkspaceOssClient(workspaceId);
  return client.getObjectUrl(objectKey);
};

