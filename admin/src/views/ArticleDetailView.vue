<script setup lang="ts">
import { getArticle, listPublications, publishArticle } from '@/apis/articles'
import { getIntegrations } from '@/apis/integrations'
import type { Article, ArticlePublication, Integration } from '@/types/api'
import { message } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const id = Number(route.params.id)

const loading = ref(false)
const article = ref<Article | null>(null)

const integrations = ref<Integration[]>([])
const publishIntegrationId = ref<number | null>(null)
const platformType = ref<number>(1)

const pubs = ref<ArticlePublication[]>([])
const pubsLoading = ref(false)

const canPublish = computed(() => !!publishIntegrationId.value && !!article.value)

const load = async () => {
  loading.value = true
  try {
    const res = await getArticle(id)
    article.value = res.data
  } finally {
    loading.value = false
  }
}

const loadIntegrations = async () => {
  const res = await getIntegrations()
  integrations.value = res.data
}

const loadPubs = async () => {
  pubsLoading.value = true
  try {
    const res = await listPublications(id)
    pubs.value = res.data
  } finally {
    pubsLoading.value = false
  }
}

const doPublish = async () => {
  if (!canPublish.value) return
  await publishArticle(id, publishIntegrationId.value as number, platformType.value)
  message.success('publish job created')
  await loadPubs()
}

onMounted(async () => {
  await Promise.all([load(), loadIntegrations(), loadPubs()])
})
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Article #{{ id }}</div>
      <a-button @click="load" :loading="loading">Refresh</a-button>
    </a-space>

    <a-descriptions v-if="article" bordered size="small" :column="1">
      <a-descriptions-item label="Title">{{ article.title }}</a-descriptions-item>
      <a-descriptions-item label="Status">{{ article.status }}</a-descriptions-item>
      <a-descriptions-item label="Doc Token">{{ article.sourceDocToken }}</a-descriptions-item>
      <a-descriptions-item label="Updated">{{ article.updatedAt }}</a-descriptions-item>
    </a-descriptions>

    <a-card title="Publish" size="small">
      <a-form layout="inline">
        <a-form-item label="Integration">
          <a-select style="width: 260px" v-model:value="publishIntegrationId" placeholder="Select integration">
            <a-select-option v-for="i in integrations" :key="i.id" :value="i.id">
              {{ i.name }} (#{{ i.id }})
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="PlatformType">
          <a-input-number v-model:value="platformType" :min="1" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" :disabled="!canPublish" @click="doPublish">Publish</a-button>
        </a-form-item>
        <a-form-item>
          <a-button @click="loadPubs" :loading="pubsLoading">Refresh publications</a-button>
        </a-form-item>
      </a-form>

      <a-table :dataSource="pubs" :loading="pubsLoading" rowKey="id" size="small" :pagination="false" style="margin-top: 12px">
        <a-table-column title="Platform" dataIndex="platformType" />
        <a-table-column title="Integration" dataIndex="integrationId" />
        <a-table-column title="Status" dataIndex="status" />
        <a-table-column title="Updated" dataIndex="updatedAt" />
      </a-table>
    </a-card>

    <a-card title="Content (final markdown)" size="small">
      <a-textarea v-if="article" :value="article.contentMdFinal" :rows="18" readonly />
    </a-card>
  </a-space>
</template>
