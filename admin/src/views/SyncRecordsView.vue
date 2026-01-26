<script setup lang="ts">
import { getIntegrations, listSyncs } from '@/apis/integrations'
import type { FeishuSpaceSync, Integration } from '@/types/api'
import { message } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'

const integrations = ref<Integration[]>([])
const integrationsLoading = ref(false)

const integrationId = ref<number | null>(null)

const loading = ref(false)
const data = ref<FeishuSpaceSync[]>([])

const canLoad = computed(() => !!integrationId.value)

const loadIntegrations = async () => {
  integrationsLoading.value = true
  try {
    integrations.value = await getIntegrations()
  } finally {
    integrationsLoading.value = false
  }
}

const load = async () => {
  if (!canLoad.value) return
  loading.value = true
  try {
    data.value = await listSyncs(integrationId.value as number)
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'failed to load')
  } finally {
    loading.value = false
  }
}

const onIntegrationChange = async () => {
  await load()
}

onMounted(loadIntegrations)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Sync Records</div>
      <a-button @click="load" :disabled="!canLoad" :loading="loading">Refresh</a-button>
    </a-space>

    <a-form layout="inline">
      <a-form-item label="Integration">
        <a-select
          style="width: 260px"
          :loading="integrationsLoading"
          v-model:value="integrationId"
          placeholder="Select integration"
          @change="onIntegrationChange"
        >
          <a-select-option v-for="i in integrations" :key="i.id" :value="i.id">
            {{ i.name }} (#{{ i.id }})
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-form>

    <a-table :dataSource="data" :loading="loading" rowKey="id" size="small" :pagination="false">
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Doc Token" dataIndex="docToken" />
      <a-table-column title="Status" dataIndex="status" />
      <a-table-column title="Last Synced" dataIndex="lastSyncedAt" />
      <a-table-column title="Last Error" dataIndex="lastError" />
      <a-table-column title="Updated" dataIndex="updatedAt" />
    </a-table>
  </a-space>
</template>
