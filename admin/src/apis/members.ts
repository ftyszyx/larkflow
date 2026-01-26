import request from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

const base = () => {
  const auth = useAuthStore()
  const wid = auth.activeWorkspaceId?.trim()
  if (!wid) throw new Error('workspace not selected')
  return `/w/${wid}`
}

export type WorkspaceMember = {
  userId: number
  email: string
  name: string | null
  role: string
  createdAt: string
}

export const listMembers = async () => {
  return (await request.get(`${base()}/members`)) as WorkspaceMember[]
}

export const updateMemberRole = async (userId: number, role: string) => {
  return (await request.patch(`${base()}/members/${userId}`, { role })) as any
}
