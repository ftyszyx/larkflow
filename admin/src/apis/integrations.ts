import request from '@/utils/request'
import type { ApiPagedResponse, FeishuSpaceSync, Integration } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const base = () => {
  const auth = useAuthStore()
  const wid = auth.activeWorkspaceId?.trim()
  if (!wid) throw new Error('workspace not selected')
  return `/w/${wid}`
}

export const getIntegrations = async () => {
  return (await request.get(`${base()}/integrations`)) as Integration[]
}

export type CreateIntegrationBody = {
  platform_type: number | string
  name: string
  status?: string
  config?: Record<string, unknown>
}

export type PatchIntegrationBody = Partial<CreateIntegrationBody>

export const createIntegration = async (body: CreateIntegrationBody) => {
  return (await request.post(`${base()}/integrations`, body)) as Integration
}

export const updateIntegration = async (id: number, body: PatchIntegrationBody) => {
  return (await request.patch(`${base()}/integrations/${id}`, body)) as Integration
}

export const deleteIntegration = async (id: number) => {
  return (await request.delete(`${base()}/integrations/${id}`)) as { id: number }
}

export const triggerSync = async (integrationId: number, docUrl: string) => {
  return (await request.post(`${base()}/integrations/${integrationId}/sync`, { doc_url: docUrl })) as any
}

export const getSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.get(`${base()}/integrations/${integrationId}/sync`, { params: { doc_token: docToken } })) as FeishuSpaceSync
}

export const resetSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.post(`${base()}/integrations/${integrationId}/sync/reset`, { doc_token: docToken })) as FeishuSpaceSync
}

export const listSyncRecords = async (opts: { integrationId?: number | null; docToken?: string | null; page?: number; pageSize?: number } = {}) => {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const params: Record<string, unknown> = {
    page,
    page_size: pageSize,
  }
  if (opts.integrationId) params.integration_id = opts.integrationId
  if (opts.docToken?.trim()) params.doc_token = opts.docToken.trim()

  return (await request.get(`${base()}/syncs`, { params })) as ApiPagedResponse<FeishuSpaceSync>
}

export const listWorkspaceSyncs = async (page = 1, pageSize = 20) => {
  return await listSyncRecords({ page, pageSize })
}

export const listSyncs = async (integrationId: number, page = 1, pageSize = 20) => {
  return await listSyncRecords({ integrationId, page, pageSize })
}

export const deleteSyncRecord = async (syncId: number) => {
  return (await request.delete(`${base()}/syncs/${syncId}`)) as { id: number }
}
