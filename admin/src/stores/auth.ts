import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const LS_TOKEN_KEY = 'larkflow_admin_token'
const LS_WORKSPACE_KEY = 'larkflow_admin_active_workspace_id'

export type AuthedUser = {
  id: number
  email: string
  name: string | null
  isPlatformAdmin: boolean
}

export type WorkspaceBrief = {
  id: number
  name: string
  createdAt: string
  updatedAt: string
  role: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(LS_TOKEN_KEY) ?? '')
  const activeWorkspaceId = ref<string>(localStorage.getItem(LS_WORKSPACE_KEY) ?? '')

  const user = ref<AuthedUser | null>(null)
  const workspaces = ref<WorkspaceBrief[]>([])

  watch(token, (v) => {
    if (v) localStorage.setItem(LS_TOKEN_KEY, v)
    else localStorage.removeItem(LS_TOKEN_KEY)
  })

  watch(activeWorkspaceId, (v) => {
    if (v) localStorage.setItem(LS_WORKSPACE_KEY, v)
    else localStorage.removeItem(LS_WORKSPACE_KEY)
  })

  const isLoggedIn = computed(() => !!token.value.trim())

  const setSession = (newToken: string) => {
    token.value = newToken
  }

  const clearSession = () => {
    token.value = ''
    user.value = null
    workspaces.value = []
    activeWorkspaceId.value = ''
  }

  const setActiveWorkspace = (workspaceId: number | string) => {
    activeWorkspaceId.value = String(workspaceId)
  }

  return {
    token,
    activeWorkspaceId,
    user,
    workspaces,
    isLoggedIn,
    setSession,
    clearSession,
    setActiveWorkspace,
  }
})
