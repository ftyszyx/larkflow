import request from '@/utils/request'

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
  return (await request.get('/platform/workspaces')) as PlatformWorkspace[]
}

export const platformCreateWorkspace = async (name: string) => {
  return (await request.post('/platform/workspaces', { name })) as PlatformWorkspace
}

export const platformUpdateWorkspace = async (workspaceId: number, name: string) => {
  return (await request.patch(`/platform/workspaces/${workspaceId}`, { name })) as PlatformWorkspace
}

export const platformDeleteWorkspace = async (workspaceId: number) => {
  return (await request.delete(`/platform/workspaces/${workspaceId}`)) as { id: number }
}

export const platformListWorkspaceMembers = async (workspaceId: number) => {
  return (await request.get(`/platform/workspaces/${workspaceId}/members`)) as PlatformWorkspaceMember[]
}

export const platformUpsertWorkspaceMember = async (
  workspaceId: number,
  payload: { email: string; name?: string | null; role: string; password?: string },
) => {
  return (await request.post(`/platform/workspaces/${workspaceId}/members`, payload)) as any
}

export const platformDeleteWorkspaceMember = async (workspaceId: number, userId: number) => {
  return (await request.delete(`/platform/workspaces/${workspaceId}/members/${userId}`)) as { workspaceId: number; userId: number }
}
