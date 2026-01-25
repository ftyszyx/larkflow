export type ApiListResponse<T> = {
  data: T[]
  limit?: number
  offset?: number
}

export type ApiObjectResponse<T> = {
  data: T
}

export type Workspace = {
  id: number
  name: string
  createdAt: string
  updatedAt: string
  role: string
}

export type Integration = {
  id: number
  workspaceId: number
  platformType: number
  feishuWorkspaceId?: string | null
  name: string
  status: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type FeishuSpaceSync = {
  id: number
  integrationId: number
  docToken: string
  status: string
  lastSyncedAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

export type Article = {
  id: number
  workspaceId: number
  integrationId: number
  sourceDocToken: string
  title: string
  status: string
  coverUrl?: string | null
  contentMd: string
  contentMdFinal: string
  createdAt: string
  updatedAt: string
}

export type ArticlePublication = {
  id: number
  workspaceId: number
  articleId: number
  integrationId: number
  platformType: number
  status: string
  remoteId?: string | null
  remoteUrl?: string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}
