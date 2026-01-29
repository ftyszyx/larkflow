<script setup lang="ts">
import { aiApplyArticle, aiGenerateArticle, getArticle, listPublications, publishArticle, updateArticle } from "@/apis/articles";
import { getIntegrations } from "@/apis/integrations";
import type { Article, ArticlePublication, Integration } from "@/types/api";
import { message } from "ant-design-vue";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import MarkdownIt from "markdown-it";
import { PlatformType } from "@/types/const";
import { useI18n } from "vue-i18n";

const route = useRoute();
const id = Number(route.params.id);

const loading = ref(false);
const article = ref<Article | null>(null);
const { t } = useI18n();

const can_publish_integrations = ref<Integration[]>([]);
const publishIntegrationId = ref<number | null>(null);

const pubs = ref<ArticlePublication[]>([]);
const pubsLoading = ref(false);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

const contentHtml = computed(() => {
  const raw = article.value?.contentMdFinal ?? "";
  return md.render(raw);
});

const previewOpen = ref(false);

const editMode = ref(false);
const saving = ref(false);
const aiGenerating = ref(false);
const editForm = ref({
  title: "",
  coverUrl: "" as string | null,
  status: "",
  contentMdFinal: "",
});

const canPublish = computed(() => !!publishIntegrationId.value && !!article.value);

const load = async () => {
  loading.value = true;
  try {
    const res = await getArticle(id);
    article.value = res;
    if (!editMode.value) {
      editForm.value = {
        title: res.title ?? "",
        coverUrl: res.coverUrl ?? null,
        status: res.status ?? "",
        contentMdFinal: res.contentMdFinal ?? "",
      };
    }
  } finally {
    loading.value = false;
  }
};

const doAiGenerate = async () => {
  if (!article.value) return;
  aiGenerating.value = true;
  try {
    const gen = await aiGenerateArticle(article.value.id, {
      generate_covers: true,
      platform_type: PlatformType.WechatMp,
    });
    const coverId = gen.generatedCovers[0]?.id;
    const updated = await aiApplyArticle(article.value.id, {
      title_final: gen.draft.suggestedTitles[0] ?? null,
      content_md_final: gen.draft.optimizedContentMd,
      cover_id: coverId,
    });
    article.value = updated;
    if (!editMode.value) {
      editForm.value = {
        title: updated.title ?? "",
        coverUrl: updated.coverUrl ?? null,
        status: updated.status ?? "",
        contentMdFinal: updated.contentMdFinal ?? "",
      };
    }
    message.success(t("article_detail.aiGenerated"));
  } finally {
    aiGenerating.value = false;
  }
};

const loadIntegrations = async () => {
  const res = await getIntegrations();
  can_publish_integrations.value = res.filter((i) => i.platformType !== PlatformType.Feishu);
};

const loadPubs = async () => {
  pubsLoading.value = true;
  try {
    const res = await listPublications(id);
    pubs.value = res;
  } finally {
    pubsLoading.value = false;
  }
};

const doPublish = async () => {
  if (!canPublish.value) return;
  await publishArticle(id, publishIntegrationId.value as number);
  message.success(t("article.publishSuccess"));
  await loadPubs();
};

const startEdit = () => {
  if (!article.value) return;
  editMode.value = true;
  editForm.value = {
    title: article.value.title ?? "",
    coverUrl: article.value.coverUrl ?? null,
    status: article.value.status ?? "",
    contentMdFinal: article.value.contentMdFinal ?? "",
  };
};

const cancelEdit = () => {
  editMode.value = false;
  void load();
};

const saveEdit = async () => {
  if (!article.value) return;
  saving.value = true;
  try {
    const updated = await updateArticle(article.value.id, {
      title: editForm.value.title,
      cover_url: editForm.value.coverUrl,
      status: editForm.value.status,
      content_md_final: editForm.value.contentMdFinal,
    });
    article.value = updated;
    editMode.value = false;
    message.success(t("article_detail.saved"));
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await Promise.all([load(), loadIntegrations(), loadPubs()]);
});
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Article #{{ id }}</div>
      <a-space>
        <a-button v-if="!editMode" @click="startEdit" :disabled="!article">{{ $t('common.edit') }}</a-button>
        <a-button v-if="editMode" @click="cancelEdit">{{ $t('common.cancel') }}</a-button>
        <a-button v-if="editMode" type="primary" @click="saveEdit" :loading="saving">{{ $t('common.save') }}</a-button>
        <a-button @click="load" :loading="loading">Refresh</a-button>
      </a-space>
    </a-space>

    <a-descriptions v-if="article" bordered size="small" :column="1">
      <a-descriptions-item :label="$t('article.title')">
        <template v-if="editMode">
          <a-input v-model:value="editForm.title" />
        </template>
        <template v-else>{{ article.title }}</template>
      </a-descriptions-item>
      <a-descriptions-item :label="$t('article.status')">
        <template v-if="editMode">
          <a-input v-model:value="editForm.status" />
        </template>
        <template v-else>{{ article.status }}</template>
      </a-descriptions-item>
      <a-descriptions-item :label="$t('article.cover')">
        <template v-if="editMode">
          <a-input v-model:value="editForm.coverUrl" :placeholder="$t('article.cover')" />
        </template>
        <template v-else>
          <a-space direction="vertical">
            <a-space>
              <a-button size="small" :loading="aiGenerating" :disabled="!article" @click="doAiGenerate">{{ $t('article_detail.aiGenerate') }}</a-button>
            </a-space>
            <template v-if="article.coverUrl">
              <a-image :src="article.coverUrl" style="max-width: 260px" />
            </template>
            <template v-else>-</template>
          </a-space>
        </template>
      </a-descriptions-item>
      <a-descriptions-item :label="$t('article.sourceDocUrl')"
        ><a :href="article.sourceDocUrl" target="_blank">{{ article.sourceDocUrl }}</a></a-descriptions-item
      >
      <a-descriptions-item :label="$t('article.sourceDocToken')">{{ article.sourceDocToken }}</a-descriptions-item>
      <a-descriptions-item :label="$t('article.updatedAt')">{{ article.updatedAt }}</a-descriptions-item>
    </a-descriptions>

    <a-card :title="$t('article_detail.publish')" size="small">
      <a-form layout="inline">
        <a-form-item :label="$t('article_detail.integration')">
          <a-select style="width: 260px" v-model:value="publishIntegrationId" :placeholder="$t('article_detail.select_integration')">
            <a-select-option v-for="i in can_publish_integrations" :key="i.id" :value="i.id"> {{ i.name }} (#{{ i.id }}) </a-select-option>
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
        <a-table-column :title="$t('article_detail.integration')" dataIndex="integrationId" />
        <a-table-column :title="$t('article_detail.status')" dataIndex="status" />
        <a-table-column :title="$t('article_detail.updatedAt')" dataIndex="updatedAt" />
      </a-table>
    </a-card>

    <a-card :title="$t('article_detail.content')" size="small">
      <div v-if="article" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px">
        <div style="min-width: 0">
          <div style="color: #999; font-size: 12px; margin-bottom: 6px">Markdown</div>
          <a-textarea v-if="editMode" v-model:value="editForm.contentMdFinal" :rows="18" />
          <a-textarea v-else :value="article.contentMdFinal" :rows="18" readonly />
        </div>
        <div style="min-width: 0">
          <a-space style="width: 100%; justify-content: space-between; margin-bottom: 6px">
            <div style="color: #999; font-size: 12px">{{ $t("article_detail.preview") }}</div>
            <a-button size="small" @click="previewOpen = true">Full Preview</a-button>
          </a-space>
          <div
            v-html="contentHtml"
            style="
              border: 1px solid #f0f0f0;
              border-radius: 6px;
              padding: 12px;
              height: 378px;
              overflow: auto;
              overflow-wrap: anywhere;
              word-break: break-word;
            "
          />
        </div>
      </div>
    </a-card>

    <a-modal v-model:open="previewOpen" :title="$t('article_detail.markdown_preview')" :footer="null" width="90%">
      <div
        v-html="contentHtml"
        style="
          height: 80vh;
          overflow: auto;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          padding: 12px;
          overflow-wrap: anywhere;
          word-break: break-word;
        "
      />
    </a-modal>
  </a-space>
</template>
