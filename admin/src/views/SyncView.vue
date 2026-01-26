<script setup lang="ts">
import { getIntegrations, getSyncStatus, resetSyncStatus, triggerSync } from '@/apis/integrations'
import type { FeishuSpaceSync, Integration } from '@/types/api'
import { message } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'

const integrations = ref<Integration[]>([])
const integrationsLoading = ref(false)

const integrationId = ref<number | null>(null)
const docToken = ref('')

const sync = ref<FeishuSpaceSync | null>(null)
const loading = ref(false)

const canRun = computed(() => !!integrationId.value && !!docToken.value.trim())

const loadIntegrations = async () => {
  integrationsLoading.value = true
  try {
    const res = await getIntegrations()
    integrations.value = res
  } finally {
    integrationsLoading.value = false
  }
}

const runSync = async () => {
  if (!canRun.value) return
  loading.value = true
  try {
    await triggerSync(integrationId.value as number, docToken.value.trim())
    message.success('sync job created')
    await refreshStatus()
  } finally {
    loading.value = false
  }
}

const refreshStatus = async () => {
  if (!canRun.value) return
  loading.value = true
  try {
    const res = await getSyncStatus(integrationId.value as number, docToken.value.trim())
    sync.value = res
  } finally {
    loading.value = false
  }
}

const reset = async () => {
  if (!canRun.value) return
  loading.value = true
  try {
    const res = await resetSyncStatus(integrationId.value as number, docToken.value.trim())
    sync.value = res
    message.success('reset done')
  } finally {
    loading.value = false
  }
}

onMounted(loadIntegrations)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <div style="font-size: 18px; font-weight: 600">Sync Feishu Doc</div>

    <a-form layout="inline">
      <a-form-item label="Integration">
        <a-select
          style="width: 260px"
          :loading="integrationsLoading"
          v-model:value="integrationId"
          placeholder="Select integration"
        >
          <a-select-option v-for="i in integrations" :key="i.id" :value="i.id">
            {{ i.name }} (#{{ i.id }})
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="Doc Token">
        <a-input style="width: 320px" v-model:value="docToken" placeholder="doccn..." />
      </a-form-item>

      <a-form-item>
        <a-button type="primary" :disabled="!canRun" :loading="loading" @click="runSync">Sync</a-button>
      </a-form-item>

      <a-form-item>
        <a-button :disabled="!canRun" :loading="loading" @click="refreshStatus">Refresh</a-button>
      </a-form-item>

      <a-form-item>
        <a-button danger :disabled="!canRun" :loading="loading" @click="reset">Reset</a-button>
      </a-form-item>
    </a-form>

    <a-descriptions v-if="sync" bordered size="small" :column="1">
      <a-descriptions-item label="Status">{{ sync.status }}</a-descriptions-item>
      <a-descriptions-item label="Last Synced">{{ sync.lastSyncedAt }}</a-descriptions-item>
      <a-descriptions-item label="Last Error">{{ sync.lastError }}</a-descriptions-item>
      <a-descriptions-item label="Updated">{{ sync.updatedAt }}</a-descriptions-item>
    </a-descriptions>
  </a-space>
</template>
