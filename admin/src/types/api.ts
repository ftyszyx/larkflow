export type ApiListResponse<T> = {
  data: T[]
  limit?: number
  offset?: number
}

export type ApiObjectResponse<T> = {
  data: T
}

export type ApiPagedResponse<T> = {
  items: T[]
  total: number
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
  name: string
  status: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type Job = {
  id: number
  workspaceId?: number | null
  queue: string
  payload: Record<string, unknown>
  attempts: number
  maxAttempts: number
  scheduledAt: string
  lockedBy?: string | null
  lockedUntil?: string | null
  createdAt: string
  updatedAt: string
}

export type FeishuSpaceSync = {
  id: number
  integrationId: number
  docToken: string
  docUrl: string
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
  sourceDocUrl: string
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
  articleId: number
  integrationId: number
  status: string
  remoteId?: string | null
  remoteUrl?: string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}
