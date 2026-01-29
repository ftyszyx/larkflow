export type GrsChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GrsChatCompletionRequest = {
  model: string;
  stream?: boolean;
  messages: GrsChatMessage[];
};

export type GrsChatClientOptions = {
  apiKey?: string | null;
  baseUrl?: string;
};

export type GrsChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string | null;
  }>;
};

const getEnv = (key: string) => {
  const v = Deno.env.get(key);
  return v && v.trim() ? v.trim() : null;
};

export const grsChatCompletion = async (req: GrsChatCompletionRequest, opts: GrsChatClientOptions = {}): Promise<GrsChatCompletionResponse> => {
  const apiKey = opts.apiKey ?? getEnv("GRS_AI_API_KEY");
  if (!apiKey) throw new Error("missing GRS_AI_API_KEY");

  const baseUrl = opts.baseUrl ?? getEnv("GRS_AI_BASE_URL") ?? "https://grsaiapi.com";
  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...req, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`grs chat failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as GrsChatCompletionResponse;
  return data;
};

export const extractFirstAssistantContent = (data: GrsChatCompletionResponse): string => {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("empty chat completion");
  return content;
};
