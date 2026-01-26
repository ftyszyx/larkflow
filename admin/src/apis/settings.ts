import request from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

export type WorkspaceOssConfig = {
  region: string
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint?: string
  publicBaseUrl?: string
}

export type WorkerSettingsValue = {
  concurrency: number
  pollMs: number
  lockSeconds: number
}

const base = () => {
  const auth = useAuthStore()
  const wid = auth.activeWorkspaceId?.trim()
  if (!wid) throw new Error('workspace not selected')
  return `/w/${wid}`
}

export const getOssSettings = async () => {
  return (await request.get(`${base()}/settings/oss`)) as WorkspaceOssConfig | null
}

export const updateOssSettings = async (value: WorkspaceOssConfig) => {
  return (await request.put(`${base()}/settings/oss`, { value })) as WorkspaceOssConfig | null
}

export const getWorkerSettings = async () => {
  return (await request.get('/platform/settings/worker')) as WorkerSettingsValue | null
}

export const updateWorkerSettings = async (value: WorkerSettingsValue) => {
  return (await request.put('/platform/settings/worker', { value })) as WorkerSettingsValue | null
}
