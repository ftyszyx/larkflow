<script setup lang="ts">
import { listArticles } from '@/apis/articles'
import type { Article } from '@/types/api'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const status = ref<string | undefined>(undefined)
const pageSize = ref(20)
const currentPage = ref(1)
const total = ref(0)

const loading = ref(false)
const data = ref<Article[]>([])

const load = async () => {
  loading.value = true
  try {
    const res = await listArticles({ status: status.value, page: currentPage.value, page_size: pageSize.value })
    data.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const onStatusChange = async () => {
  currentPage.value = 1
  await load()
}

const onTableChange = async (pagination: any) => {
  const nextCurrent = Number(pagination?.current ?? 1)
  const nextPageSize = Number(pagination?.pageSize ?? pageSize.value)
  currentPage.value = Number.isFinite(nextCurrent) && nextCurrent > 0 ? nextCurrent : 1
  pageSize.value = Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : pageSize.value
  await load()
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

    <a-space :size="12" style="width: 100%">
      <a-select allowClear style="width: 160px" v-model:value="status" placeholder="all" @change="onStatusChange">
        <a-select-option value="draft">draft</a-select-option>
        <a-select-option value="ready">ready</a-select-option>
        <a-select-option value="published">published</a-select-option>
        <a-select-option value="archived">archived</a-select-option>
      </a-select>
    </a-space>

    <a-table
      :dataSource="data"
      :loading="loading"
      rowKey="id"
      size="small"
      :pagination="{ current: currentPage, pageSize, total, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }"
      @change="onTableChange"
      :customRow="(record: unknown) => ({ onClick: () => onRowClick(record as any) })"
    >
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Title" dataIndex="title" />
      <a-table-column title="Status" dataIndex="status" />
      <a-table-column title="Updated" dataIndex="updatedAt" />
    </a-table>
  </a-space>
</template>
