<script setup lang="ts">
import { listArticles } from '@/apis/articles'
import type { Article } from '@/types/api'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const status = ref<string | undefined>(undefined)
const limit = ref(20)
const offset = ref(0)

const loading = ref(false)
const data = ref<Article[]>([])

const load = async () => {
  loading.value = true
  try {
    const res = await listArticles({ status: status.value, limit: limit.value, offset: offset.value })
    data.value = res.items
  } finally {
    loading.value = false
  }
}

const onRowClick = (record: Article) => {
  router.push(`/articles/${record.id}`)
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Articles</div>
      <a-button @click="load" :loading="loading">Refresh</a-button>
    </a-space>

    <a-form layout="inline">
      <a-form-item label="Status">
        <a-select allowClear style="width: 160px" v-model:value="status" placeholder="all">
          <a-select-option value="draft">draft</a-select-option>
          <a-select-option value="ready">ready</a-select-option>
          <a-select-option value="published">published</a-select-option>
          <a-select-option value="archived">archived</a-select-option>
        </a-select>
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

    <a-table :dataSource="data" :loading="loading" rowKey="id" size="small" :pagination="false"
      :customRow="(record: unknown) => ({ onClick: () => onRowClick(record as any) })"
    >
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Title" dataIndex="title" />
      <a-table-column title="Status" dataIndex="status" />
      <a-table-column title="Updated" dataIndex="updatedAt" />
    </a-table>
  </a-space>
</template>
