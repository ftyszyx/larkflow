<script setup lang="ts">
import { getArticle, listPublications, publishArticle } from '@/apis/articles'
import { getIntegrations } from '@/apis/integrations'
import type { Article, ArticlePublication, Integration } from '@/types/api'
import { message } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import MarkdownIt from 'markdown-it'
import { PlatformType } from '@/types/const'

const route = useRoute()
const id = Number(route.params.id)

const loading = ref(false)
const article = ref<Article | null>(null)

const can_publish_integrations = ref<Integration[]>([])
const publishIntegrationId = ref<number | null>(null)

const pubs = ref<ArticlePublication[]>([])
const pubsLoading = ref(false)

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

const contentHtml = computed(() => {
  const raw = article.value?.contentMdFinal ?? ''
  return md.render(raw)
})

const previewOpen = ref(false)

const canPublish = computed(() => !!publishIntegrationId.value && !!article.value)

const load = async () => {
  loading.value = true
  try {
    const res = await getArticle(id)
    article.value = res
  } finally {
    loading.value = false
  }
}

const loadIntegrations = async () => {
  const res = await getIntegrations()
  can_publish_integrations.value = res.filter((i) => i.platformType !== PlatformType.Feishu)
}

const loadPubs = async () => {
  pubsLoading.value = true
  try {
    const res = await listPublications(id)
    pubs.value = res
  } finally {
    pubsLoading.value = false
  }
}

const doPublish = async () => {
  if (!canPublish.value) return
  await publishArticle(id, publishIntegrationId.value as number)
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
      <a-descriptions-item label="Cover">
        <template v-if="article.coverUrl">
          <a-image :src="article.coverUrl" style="max-width: 260px" />
        </template>
        <template v-else>-</template>
      </a-descriptions-item>
      <a-descriptions-item label="source doc url"><a :href="article.sourceDocUrl" target="_blank">{{ article.sourceDocUrl }}</a></a-descriptions-item>
      <a-descriptions-item label="Doc Token">{{ article.sourceDocToken }}</a-descriptions-item>
      <a-descriptions-item label="Updated">{{ article.updatedAt }}</a-descriptions-item>
    </a-descriptions>

    <a-card title="Publish" size="small">
      <a-form layout="inline">
        <a-form-item label="Integration">
          <a-select style="width: 260px" v-model:value="publishIntegrationId" placeholder="Select integration">
            <a-select-option v-for="i in can_publish_integrations" :key="i.id" :value="i.id">
              {{ i.name }} (#{{ i.id }})
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" :disabled="!canPublish" @click="doPublish">Publish</a-button>
        </a-form-item>
        <a-form-item>
          <a-button @click="loadPubs" :loading="pubsLoading">Refresh publications</a-button>
        </a-form-item>
      </a-form>

      <a-table :dataSource="pubs" :loading="pubsLoading" rowKey="id" size="small" :pagination="false" style="margin-top: 12px">
        <a-table-column title="Integration" dataIndex="integrationId" />
        <a-table-column title="Status" dataIndex="status" />
        <a-table-column title="Updated" dataIndex="updatedAt" />
      </a-table>
    </a-card>

    <a-card title="Content (final markdown)" size="small">
      <div v-if="article" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px">
        <div style="min-width: 0">
          <div style="color: #999; font-size: 12px; margin-bottom: 6px">Markdown</div>
          <a-textarea :value="article.contentMdFinal" :rows="18" readonly />
        </div>
        <div style="min-width: 0">
          <a-space style="width: 100%; justify-content: space-between; margin-bottom: 6px">
            <div style="color: #999; font-size: 12px">Preview</div>
            <a-button size="small" @click="previewOpen = true">Full Preview</a-button>
          </a-space>
          <div
            v-html="contentHtml"
            style="border: 1px solid #f0f0f0; border-radius: 6px; padding: 12px; height: 378px; overflow: auto; overflow-wrap: anywhere; word-break: break-word"
          />
        </div>
      </div>
    </a-card>

    <a-modal v-model:open="previewOpen" title="Markdown Preview" :footer="null" width="90%">
      <div
        v-html="contentHtml"
        style="height: 80vh; overflow: auto; border: 1px solid #f0f0f0; border-radius: 6px; padding: 12px; overflow-wrap: anywhere; word-break: break-word"
      />
    </a-modal>
  </a-space>
</template>
