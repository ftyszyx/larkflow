<script setup lang="ts">
import { useContextStore } from '@/stores/context'
import { getWorkspaces } from '@/apis/workspaces'
import { ref } from 'vue'
import type { Workspace } from '@/types/api'

const ctx = useContextStore()

const loading = ref(false)
const workspaces = ref<Workspace[]>([])

const loadWorkspaces = async () => {
  loading.value = true
  try {
    const res = await getWorkspaces()
    workspaces.value = res
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <div style="font-size: 18px; font-weight: 600">Settings / Request</div>

    <a-form layout="vertical">
      <a-form-item label="X-Api-Key (optional)">
        <a-input v-model:value="ctx.apiKey" placeholder="API_KEY" />
      </a-form-item>

      <a-form-item label="X-User-Email">
        <a-input v-model:value="ctx.userEmail" placeholder="user@example.com" />
      </a-form-item>

      <a-form-item label="X-User-Name (optional)">
        <a-input v-model:value="ctx.userName" placeholder="Your name" />
      </a-form-item>

      <a-form-item label="X-Workspace-Id">
        <a-input v-model:value="ctx.workspaceId" placeholder="1" />
      </a-form-item>

      <a-form-item>
        <a-button :loading="loading" @click="loadWorkspaces">Load my workspaces</a-button>
      </a-form-item>
    </a-form>

    <a-table :dataSource="workspaces" :loading="loading" rowKey="id" size="small" :pagination="false">
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Name" dataIndex="name" />
      <a-table-column title="Role" dataIndex="role" />
    </a-table>
  </a-space>
</template>
