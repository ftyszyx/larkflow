export type NanoBananaDrawRequest = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  urls?: string[];
  webHook?: string;
  shutProgress?: boolean;
};

export type NanoBananaClientOptions = {
  apiKey?: string | null;
  baseUrl?: string;
};

export type NanoBananaDrawResponse = {
  id: string;
  results: Array<{
    url: string;
    content?: string;
  }>;
  progress?: number;
  status?: string;
  failure_reason?: string;
  error?: string;
};

const getEnv = (key: string) => {
  const v = Deno.env.get(key);
  return v && v.trim() ? v.trim() : null;
};

export const nanoBananaDraw = async (req: NanoBananaDrawRequest, opts: NanoBananaClientOptions = {}): Promise<NanoBananaDrawResponse> => {
  const apiKey = opts.apiKey ?? getEnv("GRS_NANO_BANANA_API_KEY") ?? getEnv("GRS_AI_API_KEY");
  if (!apiKey) throw new Error("missing GRS_NANO_BANANA_API_KEY");

  const baseUrl = opts.baseUrl ?? getEnv("GRS_NANO_BANANA_BASE_URL") ?? "https://grsai.dakka.com.cn";
  const url = `${baseUrl.replace(/\/$/, "")}/v1/draw/nano-banana`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`nano-banana failed: ${res.status} ${text}`);
  }

  return (await res.json()) as NanoBananaDrawResponse;
};

export const downloadImageBytes = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`download image failed: ${res.status} ${text}`);
  }

  const ct = res.headers.get("content-type")?.trim() || "";
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, contentType: ct || null };
};

export const guessImageExt = (contentType: string | null, url: string) => {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";

  const m = url.toLowerCase().match(/\.([a-z0-9]{2,5})(\?|#|$)/);
  const ext = m?.[1];
  if (ext && ["png", "jpg", "jpeg", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  return "png";
};
