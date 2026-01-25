import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type RequestContext = {
  apiKey: string
  userEmail: string
  userName: string
  workspaceId: string
}

const LS_KEY = 'larkflow_admin_context'

export const useContextStore = defineStore('context', () => {
  const apiKey = ref('')
  const userEmail = ref('tester@example.com')
  const userName = ref('')
  const workspaceId = ref('1')

  const load = () => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      apiKey.value = String(parsed.apiKey ?? '')
      userEmail.value = String(parsed.userEmail ?? userEmail.value)
      userName.value = String(parsed.userName ?? '')
      workspaceId.value = String(parsed.workspaceId ?? workspaceId.value)
    } catch {
      // ignore
    }
  }

  const save = () => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        apiKey: apiKey.value,
        userEmail: userEmail.value,
        userName: userName.value,
        workspaceId: workspaceId.value,
      }),
    )
  }

  load()
  watch([apiKey, userEmail, userName, workspaceId], save, { deep: true })

  const headers = computed<Record<string, string>>(() => {
    const h: Record<string, string> = {
      'X-User-Email': userEmail.value,
      'X-Workspace-Id': workspaceId.value,
    }
    if (userName.value) h['X-User-Name'] = userName.value
    if (apiKey.value) h['X-Api-Key'] = apiKey.value
    return h
  })

  return { apiKey, userEmail, userName, workspaceId, headers }
})
