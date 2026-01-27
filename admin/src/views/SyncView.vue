<script setup lang="ts">
import { getIntegrations, getSyncStatus, listSyncRecords, resetSyncStatus, triggerSync } from "@/apis/integrations";
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
const createDocToken = ref("");

const sync = ref<FeishuSpaceSync | null>(null);
const loading = ref(false);

const canRun = computed(() => !!integrationId.value && !!docToken.value.trim());
const canCreate = computed(() => !!createIntegrationId.value && !!createDocToken.value.trim());

const loadIntegrations = async () => {
  integrationsLoading.value = true;
  try {
    const res = await getIntegrations();
    integrations.value = res;
  } finally {
    integrationsLoading.value = false;
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
  createDocToken.value = "";
  createOpen.value = true;
};

const submitCreate = async () => {
  if (!canCreate.value) return;
  loading.value = true;
  try {
    await triggerSync(createIntegrationId.value as number, createDocToken.value.trim());
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

const reset = async () => {
  if (!canRun.value) return;
  loading.value = true;
  try {
    const res = await resetSyncStatus(integrationId.value as number, docToken.value.trim());
    sync.value = res;
    message.success("reset done");
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
        <a-button @click="loadRecords" :loading="recordsLoading">Refresh Records</a-button>
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
      <a-table-column title="Last Synced" dataIndex="lastSyncedAt" />
      <a-table-column title="Last Error" dataIndex="lastError" />
      <a-table-column title="Updated" dataIndex="updatedAt" />
    </a-table>

    <a-modal v-model:open="createOpen" title="New Sync Task" :confirmLoading="loading" @ok="submitCreate">
      <a-form layout="vertical">
        <a-form-item label="Integration" required>
          <a-select style="width: 100%" :loading="integrationsLoading" v-model:value="createIntegrationId" placeholder="Select integration">
            <a-select-option v-for="i in integrations" :key="i.id" :value="i.id"> {{ i.name }} (#{{ i.id }}) </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Doc Token" required>
          <a-input v-model:value="createDocToken" placeholder="doccn..." />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-space>
</template>
