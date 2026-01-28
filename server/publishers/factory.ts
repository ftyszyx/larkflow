import { PlatformType } from "../constants/platform.ts";
import { PlatformPublisher } from "./platform_publisher.ts";
import { WechatMpPublisher } from "./wechat_mp_publisher.ts";

export const createPublisher = (platformType: PlatformType): PlatformPublisher => {
  if (platformType === PlatformType.WechatMp) return new WechatMpPublisher();
  if (platformType === PlatformType.Feishu) {
    throw new Error("Feishu publisher not implemented");
  }
  throw new Error(`Unsupported platformType: ${platformType}`);
};
