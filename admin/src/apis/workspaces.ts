import request from '@/utils/request'
import type { ApiListResponse, Workspace } from '@/types/api'

export const getWorkspaces = async () => {
  return (await request.get('/workspaces')) as ApiListResponse<Workspace>
}
