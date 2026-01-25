<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { login, me } from '@/apis/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)

const onSubmit = async () => {
  loading.value = true
  try {
    const res = await login(email.value.trim(), password.value)
    auth.setSession(res.data.token)

    const meRes = await me()
    auth.user = meRes.data.user
    auth.workspaces = meRes.data.workspaces

    message.success('login success')

    const active = auth.activeWorkspaceId?.trim()
    const hasActive = !!active && auth.workspaces.some((w) => String(w.id) === active)
    router.push(hasActive ? '/integrations' : '/select-workspace')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div style="max-width: 420px; margin: 120px auto">
    <a-card title="Login" size="small">
      <a-form layout="vertical">
        <a-form-item label="Email">
          <a-input v-model:value="email" placeholder="you@example.com" />
        </a-form-item>
        <a-form-item label="Password">
          <a-input-password v-model:value="password" placeholder="password" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" block :loading="loading" @click="onSubmit">Login</a-button>
        </a-form-item>
      </a-form>
      <div style="color: #999; font-size: 12px">
        This instance uses invitation-based onboarding. If you don't have an account, ask your workspace admin for an invite.
      </div>
    </a-card>
  </div>
</template>
