import { PlatformType } from "./platform.ts";

export type CoverPreset = {
  presetKey: string;
  aspectRatio: string;
  imageSize: "1K" | "2K" | "4K";
  width: number;
  height: number;
};

export const DEFAULT_COVER_PRESETS_BY_PLATFORM: Record<number, CoverPreset[]> = {
  [PlatformType.Feishu]: [
    { presetKey: "feishu_cover_16_9_1k", aspectRatio: "16:9", imageSize: "1K", width: 1200, height: 675 },
    { presetKey: "feishu_square_1_1_1k", aspectRatio: "1:1", imageSize: "1K", width: 1024, height: 1024 },
  ],
  [PlatformType.WechatMp]: [
    { presetKey: "wechat_cover_16_9_1k", aspectRatio: "16:9", imageSize: "1K", width: 1200, height: 675 },
    { presetKey: "wechat_cover_2_1_1k", aspectRatio: "2:1", imageSize: "1K", width: 1200, height: 600 },
  ],
};

export const getDefaultCoverPresets = (platformType: number): CoverPreset[] => {
  const presets = DEFAULT_COVER_PRESETS_BY_PLATFORM[platformType];
  if (Array.isArray(presets) && presets.length > 0) return presets;
  return [{ presetKey: "default", aspectRatio: "auto", imageSize: "1K", width: 1200, height: 630 }];
};
