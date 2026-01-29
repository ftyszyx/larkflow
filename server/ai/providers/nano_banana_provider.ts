import { nanoBananaDraw } from "../../utils/grs_draw.ts";
import type { ResolvedAiConfig } from "../../utils/ai_settings.ts";
import type { ImageProvider, ImageDrawRequest, ImageDrawResult, ProviderContext } from "./types.ts";

export class NanoBananaProvider implements ImageProvider {
  key = "nano-banana";

  constructor(private ai: ResolvedAiConfig) {}

  async draw(req: ImageDrawRequest, _ctx: ProviderContext): Promise<ImageDrawResult> {
    const res = await nanoBananaDraw(
      {
        model: req.model,
        prompt: req.prompt,
        aspectRatio: req.aspectRatio,
        imageSize: req.imageSize,
        urls: [],
        shutProgress: false,
      },
      {
        apiKey: this.ai.nanoBanana.apiKey,
        baseUrl: this.ai.nanoBanana.baseUrl,
      },
    );

    const url = res.results?.[0]?.url;
    if (!url) throw new Error("nano-banana empty result");

    return {
      url,
      raw: res,
    };
  }
}
