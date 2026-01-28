<script setup lang="ts">
import { deleteSyncRecord, getIntegrations, getSyncStatus, listSyncRecords, resetSyncStatus, triggerSync } from "@/apis/integrations";
import type { FeishuSpaceSync, Integration } from "@/types/api";
import { message } from "ant-design-vue";
import { computed, onMounted, ref } from "vue";

const integrations = ref<Integration[]>([]);
const integrationsLoading = ref(false);

const integrationId = ref<number | null>(null);
const docToken = ref("");

const recordsLoading = ref(false);
const records = ref<FeishuSpaceSync[]>([]);
const recordsTotal = ref(0);
const recordsPage = ref(1);
const recordsPageSize = ref(20);

const createOpen = ref(false);
const createIntegrationId = ref<number | null>(null);
const createDocUrl  = ref("");

const sync = ref<FeishuSpaceSync | null>(null);
const loading = ref(false);

const canRun = computed(() => !!integrationId.value && !!docToken.value.trim());
const canCreate = computed(() => !!createIntegrationId.value && !!createDocUrl.value.trim());

const loadIntegrations = async () => {
  integrationsLoading.value = true;
  try {
    const res = await getIntegrations();
    integrations.value = res;
  } finally {
    integrationsLoading.value = false;
  }
};

const deleteRecord = async (row: FeishuSpaceSync) => {
  if (!row?.id) return;
  loading.value = true;
  try {
    await deleteSyncRecord(row.id);
    message.success("deleted");
    await loadRecords();
  } finally {
    loading.value = false;
  }
};

const loadRecords = async () => {
  recordsLoading.value = true;
  try {
    const res = await listSyncRecords({
      integrationId: integrationId.value,
      docToken: docToken.value,
      page: recordsPage.value,
      pageSize: recordsPageSize.value,
    });
    records.value = res.items;
    recordsTotal.value = res.total;
  } finally {
    recordsLoading.value = false;
  }
};

const onIntegrationChange = async () => {
  sync.value = null;
  docToken.value = "";
  recordsPage.value = 1;
  await loadRecords();
};

const onRecordsPaginationChange = async (page: number, pageSize?: number) => {
  recordsPage.value = page;
  if (pageSize) recordsPageSize.value = pageSize;
  await loadRecords();
};

const openCreate = () => {
  createIntegrationId.value = integrationId.value;
  createDocUrl.value = "";
  createOpen.value = true;
};

const submitCreate = async () => {
  if (!canCreate.value) return;
  loading.value = true;
  try {
    await triggerSync(createIntegrationId.value as number, createDocUrl.value.trim());
    message.success("sync job created");
    createOpen.value = false;
    if (integrationId.value === createIntegrationId.value) {
      await loadRecords();
    }
  } finally {
    loading.value = false;
  }
};

const refreshStatus = async () => {
  if (!canRun.value) return;
  loading.value = true;
  try {
    const res = await getSyncStatus(integrationId.value as number, docToken.value.trim());
    sync.value = res;
  } finally {
    loading.value = false;
  }
};

const retryRecord = async (row: FeishuSpaceSync) => {
  if (!row?.integrationId || !row.docUrl?.trim()) {
    message.error("missing integrationId/docUrl");
    return;
  }
  loading.value = true;
  try {
    await triggerSync(row.integrationId, row.docUrl.trim());
    message.success("sync job created");
    await loadRecords();
  } finally {
    loading.value = false;
  }
};


onMounted(async () => {
  await loadIntegrations();
  await loadRecords();
});
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Sync</div>
      <a-space :size="8">
        <a-button type="primary" @click="openCreate">New Sync Task</a-button>
      </a-space>
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
          <a-select-option v-for="i in integrations" :key="i.id" :value="i.id"> {{ i.name }} (#{{ i.id }}) </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="Doc Token">
        <a-input style="width: 320px" v-model:value="docToken" placeholder="doccn..." />
      </a-form-item>

      <a-form-item>
        <a-button :disabled="!canRun" :loading="loading" @click="refreshStatus">Refresh</a-button>
      </a-form-item>
    </a-form>

    <a-descriptions v-if="sync" bordered size="small" :column="1">
      <a-descriptions-item label="Status">{{ sync.status }}</a-descriptions-item>
      <a-descriptions-item label="Last Synced">{{ sync.lastSyncedAt }}</a-descriptions-item>
      <a-descriptions-item label="Last Error">{{ sync.lastError }}</a-descriptions-item>
      <a-descriptions-item label="Updated">{{ sync.updatedAt }}</a-descriptions-item>
    </a-descriptions>

    <a-table
      :dataSource="records"
      :loading="recordsLoading"
      rowKey="id"
      size="small"
      :pagination="{
        current: recordsPage,
        pageSize: recordsPageSize,
        total: recordsTotal,
        showSizeChanger: true,
        onChange: onRecordsPaginationChange,
        onShowSizeChange: onRecordsPaginationChange,
      }"
    >
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Doc Token" dataIndex="docToken" />
      <a-table-column title="Status" dataIndex="status" />
      <a-table-column title="Doc Title">
        <template #default="{ record }">
          <template v-if="(record as any).docUrl">
            <a :href="(record as any).docUrl" target="_blank">{{ (record as any).docTitle || (record as any).docToken }}</a>
          </template>
          <template v-else>{{ (record as any).docTitle || (record as any).docToken }}</template>
        </template>
      </a-table-column>
      <a-table-column title="Last Synced" dataIndex="lastSyncedAt" />
      <a-table-column title="Last Error" dataIndex="lastError" />
      <a-table-column title="Updated" dataIndex="updatedAt" />
      <a-table-column title="Actions">
        <template #default="{ record }">
          <a-space :size="8">
            <a-popconfirm title="Retry this sync task?" @confirm="retryRecord(record as any)">
              <a-button size="small" :disabled="String((record as any).status ?? '').toLowerCase() === 'syncing'" :loading="loading">Retry</a-button>
            </a-popconfirm>
            <a-popconfirm title="Delete this sync record?" @confirm="deleteRecord(record as any)">
              <a-button size="small" danger :loading="loading">Delete</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </a-table>

    <a-modal v-model:open="createOpen" title="New Sync Task" :confirmLoading="loading" @ok="submitCreate">
      <a-form layout="vertical">
        <a-form-item label="Integration" required>
          <a-select style="width: 100%" :loading="integrationsLoading" v-model:value="createIntegrationId" placeholder="Select integration">
            <a-select-option v-for="i in integrations" :key="i.id" :value="i.id"> {{ i.name }} (#{{ i.id }}) </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Doc url" required>
          <a-input v-model:value="createDocUrl" placeholder="https://..." />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-space>
</template>
