import request from '@/utils/request'
import type { ApiObjectResponse } from '@/types/api'

export type LoginResponse = {
  token: string
}

export type MeResponse = {
  user: {
    id: number
    email: string
    name: string | null
    isPlatformAdmin: boolean
  }
  workspaces: Array<{
    id: number
    name: string
    createdAt: string
    updatedAt: string
    role: string
  }>
}

export const login = async (email: string, password: string) => {
  return (await request.post('/auth/login', { email, password })) as ApiObjectResponse<LoginResponse>
}

export const me = async () => {
  return (await request.get('/auth/me')) as ApiObjectResponse<MeResponse>
}
