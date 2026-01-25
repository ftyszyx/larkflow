import request from '@/utils/request'
import type { ApiObjectResponse } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const base = () => {
  const auth = useAuthStore()
  const wid = auth.activeWorkspaceId?.trim()
  if (!wid) throw new Error('workspace not selected')
  return `/w/${wid}`
}

export type CreateInvitationResponse = {
  token: string
  expiresAt: string
}

export const createInvitation = async (payload: { email: string; role: string; expiresInDays?: number }) => {
  return (await request.post(`${base()}/invitations`, payload)) as ApiObjectResponse<CreateInvitationResponse>
}
