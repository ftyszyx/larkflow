import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { me } from '@/apis/auth'

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

  const meLoading = ref(false)
  let mePromise: Promise<void> | null = null

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

  const ensureMe = async () => {
    if (!token.value?.trim()) return
    if (user.value) return
    if (mePromise) return await mePromise

    meLoading.value = true
    mePromise = (async () => {
      const res = await me()
      user.value = res.user
      workspaces.value = res.workspaces
    })()

    try {
      await mePromise
    } finally {
      mePromise = null
      meLoading.value = false
    }
  }

  return {
    token,
    activeWorkspaceId,
    user,
    workspaces,
    meLoading,
    isLoggedIn,
    setSession,
    clearSession,
    setActiveWorkspace,
    ensureMe,
  }
})
