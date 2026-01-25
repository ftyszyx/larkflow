import request from '@/utils/request'
import type { ApiListResponse, ApiObjectResponse, FeishuSpaceSync, Integration } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const base = () => {
  const auth = useAuthStore()
  const wid = auth.activeWorkspaceId?.trim()
  if (!wid) throw new Error('workspace not selected')
  return `/w/${wid}`
}

export const getIntegrations = async () => {
  return (await request.get(`${base()}/integrations`)) as ApiListResponse<Integration>
}

export type CreateIntegrationBody = {
  platformType: number
  name: string
  status?: string
  feishuWorkspaceId?: string | null
  config?: Record<string, unknown>
  accessToken?: string | null
  refreshToken?: string | null
  expiresAt?: string | null
  extra?: Record<string, unknown>
}

export type PatchIntegrationBody = Partial<CreateIntegrationBody>

export const createIntegration = async (body: CreateIntegrationBody) => {
  return (await request.post(`${base()}/integrations`, body)) as ApiObjectResponse<Integration>
}

export const updateIntegration = async (id: number, body: PatchIntegrationBody) => {
  return (await request.patch(`${base()}/integrations/${id}`, body)) as ApiObjectResponse<Integration>
}

export const deleteIntegration = async (id: number) => {
  return (await request.delete(`${base()}/integrations/${id}`)) as ApiObjectResponse<{ id: number }>
}

export const triggerSync = async (integrationId: number, docToken: string) => {
  return (await request.post(`${base()}/integrations/${integrationId}/sync`, { docToken })) as ApiObjectResponse<any>
}

export const getSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.get(`${base()}/integrations/${integrationId}/sync`, { params: { docToken } })) as ApiObjectResponse<FeishuSpaceSync>
}

export const resetSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.post(`${base()}/integrations/${integrationId}/sync/reset`, { docToken })) as ApiObjectResponse<FeishuSpaceSync>
}

export const listSyncs = async (integrationId: number) => {
  return (await request.get(`${base()}/integrations/${integrationId}/syncs`)) as ApiListResponse<FeishuSpaceSync>
}
