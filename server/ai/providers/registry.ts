import type { ResolvedAiConfig } from "../../utils/ai_settings.ts";
import { GrsChatProvider } from "./grs_chat_provider.ts";
import { NanoBananaProvider } from "./nano_banana_provider.ts";
import type { ChatProvider, ImageProvider } from "./types.ts";

export type ProviderBundle = {
  chat: ChatProvider;
  image: ImageProvider;
};

export const createProviders = (ai: ResolvedAiConfig): ProviderBundle => {
  return {
    chat: new GrsChatProvider(ai),
    image: new NanoBananaProvider(ai),
  };
};
