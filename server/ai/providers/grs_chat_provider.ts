import { extractFirstAssistantContent, grsChatCompletion } from "../../utils/grs_ai.ts";
import type { ResolvedAiConfig } from "../../utils/ai_settings.ts";
import type { ChatProvider, ChatCompleteRequest, ChatCompleteResult, ProviderContext } from "./types.ts";

export class GrsChatProvider implements ChatProvider {
  key = "grs";

  constructor(private ai: ResolvedAiConfig) {}

  async complete(req: ChatCompleteRequest, _ctx: ProviderContext): Promise<ChatCompleteResult> {
    const res = await grsChatCompletion(
      {
        model: req.model,
        stream: false,
        messages: req.messages,
      },
      {
        apiKey: this.ai.grsChat.apiKey,
        baseUrl: this.ai.grsChat.baseUrl,
      },
    );

    return {
      content: extractFirstAssistantContent(res),
      raw: res,
    };
  }
}
