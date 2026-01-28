import { PlatformType } from "../constants/platform.ts";

export type PublishArticleInput = {
  workspaceId: number;
  integrationId: number;
  article: {
    id: number;
    title: string;
    contentMdFinal: string;
    coverUrl: string | null;
  };
  integration: {
    platformType: PlatformType;
    config: Record<string, unknown>;
  };
};

export type PublishArticleResult = {
  remoteId: string;
  remoteUrl?: string;
};

export abstract class PlatformPublisher {
  abstract readonly platformType: PlatformType;

  abstract publish(input: PublishArticleInput): Promise<PublishArticleResult>;
}
