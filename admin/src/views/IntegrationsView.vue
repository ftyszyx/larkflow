<script setup lang="ts">
import { getIntegrations } from '@/apis/integrations'
import type { Integration } from '@/types/api'
import { onMounted, ref } from 'vue'

const loading = ref(false)
const data = ref<Integration[]>([])

const load = async () => {
  loading.value = true
  try {
    const res = await getIntegrations()
    data.value = res.data
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Integrations</div>
      <a-button @click="load" :loading="loading">Refresh</a-button>
    </a-space>

    <a-table :dataSource="data" :loading="loading" rowKey="id" size="small" :pagination="false">
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Name" dataIndex="name" />
      <a-table-column title="Platform" dataIndex="platformType" />
      <a-table-column title="Status" dataIndex="status" />
      <a-table-column title="Feishu Workspace" dataIndex="feishuWorkspaceId" />
    </a-table>
  </a-space>
</template>
