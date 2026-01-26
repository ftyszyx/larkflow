import request from '@/utils/request'
import type { Article, ArticlePublication } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const base = () => {
  const auth = useAuthStore()
  const wid = auth.activeWorkspaceId?.trim()
  if (!wid) throw new Error('workspace not selected')
  return `/w/${wid}`
}

export type PagedItems<T> = {
  items: T[]
  total: number
}

export const listArticles = async (params: { status?: string; page?: number; page_size?: number }) => {
  return (await request.get(`${base()}/articles`, { params })) as PagedItems<Article>
}

export const getArticle = async (id: number) => {
  return (await request.get(`${base()}/articles/${id}`)) as Article
}

export const publishArticle = async (articleId: number, integrationId: number) => {
  return (await request.post(`${base()}/articles/${articleId}/publish`, { integrations_id: integrationId })) as any
}

export const listPublications = async (articleId: number) => {
  return (await request.get(`${base()}/articles/${articleId}/publications`)) as ArticlePublication[]
}
