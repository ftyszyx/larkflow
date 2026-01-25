import request from '@/utils/request'
import type { ApiListResponse, ApiObjectResponse, Article, ArticlePublication } from '@/types/api'

export const listArticles = async (params: { status?: string; limit?: number; offset?: number }) => {
  return (await request.get('/articles', { params })) as ApiListResponse<Article>
}

export const getArticle = async (id: number) => {
  return (await request.get(`/articles/${id}`)) as ApiObjectResponse<Article>
}

export const publishArticle = async (articleId: number, integrationId: number, platformType: number) => {
  return (await request.post(`/articles/${articleId}/publish`, { integrationId, platformType })) as ApiObjectResponse<any>
}

export const listPublications = async (articleId: number) => {
  return (await request.get(`/articles/${articleId}/publications`)) as ApiListResponse<ArticlePublication>
}
