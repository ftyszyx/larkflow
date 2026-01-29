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

export const updateArticle = async (
  id: number,
  payload: { title?: string; cover_url?: string | null; content_md_final?: string; status?: string },
) => {
  return (await request.patch(`${base()}/articles/${id}`, payload)) as Article
}

export const deleteArticle = async (id: number) => {
  return (await request.delete(`${base()}/articles/${id}`)) as { id: number }
}

export type AiGenerateDraft = {
  suggestedTitles: string[]
  summary: string
  coverPrompt: string
  optimizedContentMd: string
}

export type AiGeneratedCover = {
  id: number
  platformType: number
  presetKey: string
  width: number
  height: number
  url: string
}

export const aiGenerateArticle = async (
  id: number,
  payload: { generate_covers?: boolean; platform_type?: number; preset_key?: string; preset_keys?: string[]; width?: number; height?: number } = {},
) => {
  return (await request.post(`${base()}/articles/${id}/ai/generate`, payload)) as {
    draft: AiGenerateDraft
    generatedCovers: AiGeneratedCover[]
  }
}

export const aiApplyArticle = async (
  id: number,
  payload: { title_final?: string | null; content_md_final?: string; cover_id?: number } = {},
) => {
  return (await request.post(`${base()}/articles/${id}/ai/apply`, payload)) as Article
}

export const publishArticle = async (articleId: number, integrationId: number) => {
  return (await request.post(`${base()}/articles/${articleId}/publish`, { integrations_id: integrationId })) as any
}

export const listPublications = async (articleId: number) => {
  return (await request.get(`${base()}/articles/${articleId}/publications`)) as ArticlePublication[]
}
