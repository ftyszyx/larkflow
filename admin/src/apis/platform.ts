import request from '@/utils/request'
import type { ApiListResponse, ApiObjectResponse } from '@/types/api'

export type PlatformWorkspace = {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export type PlatformWorkspaceMember = {
  userId: number
  email: string
  name: string | null
  role: string
  createdAt: string
}

export const platformListWorkspaces = async () => {
  return (await request.get('/platform/workspaces')) as ApiListResponse<PlatformWorkspace>
}

export const platformCreateWorkspace = async (name: string) => {
  return (await request.post('/platform/workspaces', { name })) as ApiObjectResponse<PlatformWorkspace>
}

export const platformListWorkspaceMembers = async (workspaceId: number) => {
  return (await request.get(`/platform/workspaces/${workspaceId}/members`)) as ApiListResponse<PlatformWorkspaceMember>
}

export const platformUpsertWorkspaceMember = async (
  workspaceId: number,
  payload: { email: string; name?: string | null; role: string; password?: string },
) => {
  return (await request.post(`/platform/workspaces/${workspaceId}/members`, payload)) as ApiObjectResponse<any>
}
