import request from '@/utils/request'
import type { ApiListResponse, ApiObjectResponse, Article, ArticlePublication } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const base = () => {
  const auth = useAuthStore()
  const wid = auth.activeWorkspaceId?.trim()
  if (!wid) throw new Error('workspace not selected')
  return `/w/${wid}`
}

export const listArticles = async (params: { status?: string; limit?: number; offset?: number }) => {
  return (await request.get(`${base()}/articles`, { params })) as ApiListResponse<Article>
}

export const getArticle = async (id: number) => {
  return (await request.get(`${base()}/articles/${id}`)) as ApiObjectResponse<Article>
}

export const publishArticle = async (articleId: number, integrationId: number, platformType: number) => {
  return (await request.post(`${base()}/articles/${articleId}/publish`, { integrationId, platformType })) as ApiObjectResponse<any>
}

export const listPublications = async (articleId: number) => {
  return (await request.get(`${base()}/articles/${articleId}/publications`)) as ApiListResponse<ArticlePublication>
}
