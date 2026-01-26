<script setup lang="ts">
import { cancelJob, listJobs, retryJob } from '@/apis/jobs'
import type { Job } from '@/types/api'
import { message } from 'ant-design-vue'
import { onMounted, ref } from 'vue'

const loading = ref(false)
const data = ref<Job[]>([])

const queue = ref<string | undefined>(undefined)
const limit = ref(50)
const offset = ref(0)

const load = async () => {
  loading.value = true
  try {
    const res = await listJobs({ queue: queue.value, limit: limit.value, offset: offset.value })
    data.value = res.items
  } finally {
    loading.value = false
  }
}

const doRetry = async (row: Job) => {
  loading.value = true
  try {
    await retryJob(row.id)
    message.success('retry scheduled')
    await load()
  } finally {
    loading.value = false
  }
}

const doCancel = async (row: Job) => {
  loading.value = true
  try {
    await cancelJob(row.id)
    message.success('canceled')
    await load()
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Jobs</div>
      <a-space :size="8">
        <a-button @click="load" :loading="loading">Refresh</a-button>
      </a-space>
    </a-space>

    <a-form layout="inline">
      <a-form-item label="Queue">
        <a-input v-model:value="queue" allowClear placeholder="sync_feishu_space / publish_article" style="width: 260px" />
      </a-form-item>
      <a-form-item label="Limit">
        <a-input-number v-model:value="limit" :min="1" :max="200" />
      </a-form-item>
      <a-form-item label="Offset">
        <a-input-number v-model:value="offset" :min="0" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="load" :loading="loading">Apply</a-button>
      </a-form-item>
    </a-form>

    <a-table :dataSource="data" :loading="loading" rowKey="id" size="small" :pagination="false">
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Queue" dataIndex="queue" />
      <a-table-column title="Attempts">
        <template #default="{ record }">
          {{ (record as any).attempts }}/{{ (record as any).maxAttempts }}
        </template>
      </a-table-column>
      <a-table-column title="Scheduled" dataIndex="scheduledAt" />
      <a-table-column title="Locked By" dataIndex="lockedBy" />
      <a-table-column title="Locked Until" dataIndex="lockedUntil" />
      <a-table-column title="Actions">
        <template #default="{ record }">
          <a-space :size="8">
            <a-popconfirm title="Retry this job?" @confirm="doRetry(record as any)">
              <a-button size="small">Retry</a-button>
            </a-popconfirm>
            <a-popconfirm title="Cancel (delete) this job?" @confirm="doCancel(record as any)">
              <a-button size="small" danger>Cancel</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </a-table>
  </a-space>
</template>
