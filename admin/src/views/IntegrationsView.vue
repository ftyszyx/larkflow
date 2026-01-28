<script setup lang="ts">
import { createIntegration, deleteIntegration, getIntegrations, updateIntegration } from "@/apis/integrations";
import type { Integration } from "@/types/api";
import { PlatformType, Status } from "@/types/const";
import { computed, onMounted, ref } from "vue";
import { message } from "ant-design-vue";

const loading = ref(false);
const data = ref<Integration[]>([]);

const recordsPage = ref(1);
const recordsPageSize = ref(20);
const recordsTotal = computed(() => data.value.length);

const tableData = computed(() => {
  const start = (recordsPage.value - 1) * recordsPageSize.value;
  return data.value.slice(start, start + recordsPageSize.value);
});

const modalOpen = ref(false);
const modalMode = ref<"create" | "edit">("create");
const editingId = ref<number | null>(null);

const formName = ref("");
const formPlatformType = ref<PlatformType>(PlatformType.Feishu);
const formStatus = ref<Status>(Status.Enable);
const formBaseUrl = ref("");
const formAppId = ref("");
const formAppSecret = ref("");
const formFeishuWorkspaceId = ref("");

const isFeishu = computed(() => formPlatformType.value === PlatformType.Feishu);

const load = async () => {
  loading.value = true;
  try {
    const res = await getIntegrations();
    data.value = res;
    recordsPage.value = 1;
  } finally {
    loading.value = false;
  }
};

const onRecordsPaginationChange = async (page: number, pageSize?: number) => {
  recordsPage.value = page;
  if (pageSize) recordsPageSize.value = pageSize;
};

const openCreate = () => {
  modalMode.value = "create";
  editingId.value = null;
  formName.value = "";
  formPlatformType.value = PlatformType.Feishu;
  formStatus.value = Status.Enable;
  formBaseUrl.value = "";
  formAppId.value = "";
  formAppSecret.value = "";
  formFeishuWorkspaceId.value = "";
  modalOpen.value = true;
};

const openEdit = (row: Integration) => {
  modalMode.value = "edit";
  editingId.value = row.id;
  formName.value = row.name;
  formPlatformType.value = row.platformType as PlatformType;
  formStatus.value = row.status === "disabled" ? Status.Disabled : Status.Enable;
  const cfg = (row.config ?? {}) as any;
  formBaseUrl.value = typeof cfg.baseUrl === "string" ? cfg.baseUrl : "";
  formAppId.value = typeof cfg.appId === "string" ? cfg.appId : "";
  formAppSecret.value = typeof cfg.appSecret === "string" ? cfg.appSecret : "";
  formFeishuWorkspaceId.value = typeof cfg.workspaceId === "string" ? cfg.workspaceId : "";
  modalOpen.value = true;
};

const submit = async () => {
  if (!formName.value.trim()) {
    message.error("name is required");
    return;
  }

  const appId = formAppId.value.trim();
  const appSecret = formAppSecret.value.trim();
  if (!appId) {
    message.error("appId is required");
    return;
  }
  if (!appSecret) {
    message.error("appSecret is required");
    return;
  }

  const config: Record<string, unknown> = {
    appId,
    appSecret,
  };

  const baseUrl = formBaseUrl.value.trim();
  if (baseUrl) config.baseUrl = baseUrl;

  if (isFeishu.value) {
    const workspaceId = formFeishuWorkspaceId.value.trim();
    if (!workspaceId) {
      message.error("workspaceId is required for feishu");
      return;
    }
    config.workspaceId = workspaceId;
  }

  const payload: any = {
    name: formName.value.trim(),
    platform_type: formPlatformType.value,
    status: formStatus.value,
    config,
  };

  loading.value = true;
  try {
    if (modalMode.value === "create") {
      await createIntegration(payload);
      message.success("created");
    } else {
      if (!editingId.value) return;
      await updateIntegration(editingId.value, payload);
      message.success("updated");
    }
    modalOpen.value = false;
    await load();
  } finally {
    loading.value = false;
  }
};

const onDelete = async (row: Integration) => {
  loading.value = true;
  try {
    await deleteIntegration(row.id);
    message.success("deleted");
    await load();
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-space style="width: 100%; justify-content: space-between">
      <div style="font-size: 18px; font-weight: 600">Integrations</div>
      <a-space :size="8">
        <a-button type="primary" @click="openCreate">New</a-button>
        <a-button @click="load" :loading="loading">Refresh</a-button>
      </a-space>
    </a-space>

    <a-table
      :dataSource="tableData"
      :loading="loading"
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
      <a-table-column title="Name" dataIndex="name" />
      <a-table-column title="Platform" dataIndex="platformType" />
      <a-table-column title="Status" dataIndex="status" />
      <a-table-column title="Actions">
        <template #default="{ record }">
          <a-space :size="8">
            <a-button size="small" @click="openEdit(record as any)">Edit</a-button>
            <a-popconfirm title="Delete this integration?" @confirm="onDelete(record as any)">
              <a-button size="small" danger>Delete</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </a-table>

    <a-modal v-model:open="modalOpen" :title="modalMode === 'create' ? 'New Integration' : 'Edit Integration'" :confirmLoading="loading" @ok="submit">
      <a-form layout="vertical">
        <a-form-item label="Name">
          <a-input v-model:value="formName" />
        </a-form-item>

        <a-form-item label="Platform Type">
          <a-select v-model:value="formPlatformType" style="width: 100%">
            <a-select-option
              v-for="[key, value] in Object.entries(PlatformType).filter(([k]) => Number.isNaN(Number(k)))"
              :key="key"
              :value="value"
              >{{ $t(`const.platformType.${key}`) }}</a-select-option
            >
          </a-select>
        </a-form-item>

        <a-form-item label="Status">
          <a-select v-model:value="formStatus">
            <a-select-option v-for="[key, value] in Object.entries(Status).filter(([k]) => Number.isNaN(Number(k)))" :key="key" :value="value">
              {{ $t(`const.status.${key}`) }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="Base URL">
          <a-input v-model:value="formBaseUrl" placeholder="Leave empty to use default" />
        </a-form-item>

        <a-form-item label="App ID" required>
          <a-input v-model:value="formAppId" />
        </a-form-item>

        <a-form-item label="App Secret" required>
          <a-input-password v-model:value="formAppSecret" />
        </a-form-item>

        <a-form-item v-if="isFeishu" label="Feishu Workspace ID" required>
          <a-input v-model:value="formFeishuWorkspaceId" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-space>
</template>
