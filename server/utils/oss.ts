import OSS from "ali-oss";

export type OssClientConfig = {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint?: string;
};

const getRequiredEnv = (name: string) => {
  const v = Deno.env.get(name);
  if (!v || !v.trim()) throw new Error(`missing env ${name}`);
  return v.trim();
};

export const createOssClientFromEnv = () => {
  const region = getRequiredEnv("OSS_REGION");
  const accessKeyId = getRequiredEnv("OSS_ACCESS_KEY_ID");
  const accessKeySecret = getRequiredEnv("OSS_ACCESS_KEY_SECRET");
  const bucket = getRequiredEnv("OSS_BUCKET");
  const endpoint = Deno.env.get("OSS_ENDPOINT")?.trim() || undefined;

  const client = new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint,
  });

  const publicBaseUrl = Deno.env.get("OSS_PUBLIC_BASE_URL")?.trim() || undefined;

  return { client, bucket, publicBaseUrl };
};

export const putObject = async (objectKey: string, body: Uint8Array) => {
  const { client, bucket, publicBaseUrl } = createOssClientFromEnv();
  await client.put(objectKey, body);

  const url = publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${objectKey}` : undefined;
  return { bucket, objectKey, url };
};
