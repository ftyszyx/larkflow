import request from '@/utils/request'
import type { ApiListResponse, ApiObjectResponse, FeishuSpaceSync, Integration } from '@/types/api'

export const getIntegrations = async () => {
  return (await request.get('/integrations')) as ApiListResponse<Integration>
}

export const triggerSync = async (integrationId: number, docToken: string) => {
  return (await request.post(`/integrations/${integrationId}/sync`, { docToken })) as ApiObjectResponse<any>
}

export const getSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.get(`/integrations/${integrationId}/sync`, { params: { docToken } })) as ApiObjectResponse<FeishuSpaceSync>
}

export const resetSyncStatus = async (integrationId: number, docToken: string) => {
  return (await request.post(`/integrations/${integrationId}/sync/reset`, { docToken })) as ApiObjectResponse<FeishuSpaceSync>
}

export const listSyncs = async (integrationId: number) => {
  return (await request.get(`/integrations/${integrationId}/syncs`)) as ApiListResponse<FeishuSpaceSync>
}
