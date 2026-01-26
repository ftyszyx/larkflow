import request from '@/utils/request'
import type { FeishuSpaceSync, Integration } from '@/types/api'
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

export const triggerSync = async (integrationId: number, docToken: string) => {
  return (await request.post(`${base()}/integrations/${integrationId}/sync`, { doc_token: docToken })) as any
}

export const getSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.get(`${base()}/integrations/${integrationId}/sync`, { params: { doc_token: docToken } })) as FeishuSpaceSync
}

export const resetSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.post(`${base()}/integrations/${integrationId}/sync/reset`, { doc_token: docToken })) as FeishuSpaceSync
}

export const listSyncs = async (integrationId: number) => {
  return (await request.get(`${base()}/integrations/${integrationId}/syncs`)) as FeishuSpaceSync[]
}
