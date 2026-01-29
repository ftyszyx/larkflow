export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompleteRequest = {
  model: string;
  messages: ChatMessage[];
};

export type ChatCompleteResult = {
  content: string;
  raw: unknown;
};

export type ImageDrawRequest = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: "1K" | "2K" | "4K";
};

export type ImageDrawResult = {
  url: string;
  raw: unknown;
};

export type ProviderContext = {
  workspaceId: number;
};

export interface ChatProvider {
  key: string;
  complete(req: ChatCompleteRequest, ctx: ProviderContext): Promise<ChatCompleteResult>;
}

export interface ImageProvider {
  key: string;
  draw(req: ImageDrawRequest, ctx: ProviderContext): Promise<ImageDrawResult>;
}
