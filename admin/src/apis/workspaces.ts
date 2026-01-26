import request from '@/utils/request'
import type { Workspace } from '@/types/api'

export const getWorkspaces = async () => {
  return (await request.get('/workspaces')) as Workspace[]
}
