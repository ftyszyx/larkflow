<script setup lang="ts">
import { createIntegration, deleteIntegration, getIntegrations, updateIntegration } from '@/apis/integrations'
import type { Integration } from '@/types/api'
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'

const loading = ref(false)
const data = ref<Integration[]>([])

const modalOpen = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)

const formName = ref('')
const formPlatformType = ref<number>(1)
const formStatus = ref('connected')
const formFeishuWorkspaceId = ref<string>('')
const formConfigJson = ref<string>('{}')
const formAccessToken = ref<string>('')
const formRefreshToken = ref<string>('')
const formExpiresAt = ref<string>('')

const load = async () => {
  loading.value = true
  try {
    const res = await getIntegrations()
    data.value = res.data
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  modalMode.value = 'create'
  editingId.value = null
  formName.value = ''
  formPlatformType.value = 1
  formStatus.value = 'connected'
  formFeishuWorkspaceId.value = ''
  formConfigJson.value = '{}'
  formAccessToken.value = ''
  formRefreshToken.value = ''
  formExpiresAt.value = ''
  modalOpen.value = true
}

const openEdit = (row: Integration) => {
  modalMode.value = 'edit'
  editingId.value = row.id
  formName.value = row.name
  formPlatformType.value = row.platformType
  formStatus.value = row.status
  formFeishuWorkspaceId.value = row.feishuWorkspaceId ?? ''
  formConfigJson.value = JSON.stringify(row.config ?? {}, null, 2)

  const anyRow = row as any
  formAccessToken.value = anyRow.accessToken ?? ''
  formRefreshToken.value = anyRow.refreshToken ?? ''
  formExpiresAt.value = anyRow.expiresAt ?? ''
  modalOpen.value = true
}

const submit = async () => {
  if (!formName.value.trim()) {
    message.error('name is required')
    return
  }

  let config: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(formConfigJson.value || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed
  } catch {
    message.error('config must be valid JSON object')
    return
  }

  const payload: any = {
    name: formName.value.trim(),
    platformType: formPlatformType.value,
    status: formStatus.value,
    feishuWorkspaceId: formFeishuWorkspaceId.value.trim() || null,
    config,
  }

  if (formAccessToken.value.trim()) payload.accessToken = formAccessToken.value.trim()
  if (formRefreshToken.value.trim()) payload.refreshToken = formRefreshToken.value.trim()
  if (formExpiresAt.value.trim()) payload.expiresAt = formExpiresAt.value.trim()

  loading.value = true
  try {
    if (modalMode.value === 'create') {
      await createIntegration(payload)
      message.success('created')
    } else {
      if (!editingId.value) return
      await updateIntegration(editingId.value, payload)
      message.success('updated')
    }
    modalOpen.value = false
    await load()
  } finally {
    loading.value = false
  }
}

const onDelete = async (row: Integration) => {
  loading.value = true
  try {
    await deleteIntegration(row.id)
    message.success('deleted')
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
      <div style="font-size: 18px; font-weight: 600">Integrations</div>
      <a-space :size="8">
        <a-button type="primary" @click="openCreate">New</a-button>
        <a-button @click="load" :loading="loading">Refresh</a-button>
      </a-space>
    </a-space>

    <a-table :dataSource="data" :loading="loading" rowKey="id" size="small" :pagination="false">
      <a-table-column title="ID" dataIndex="id" />
      <a-table-column title="Name" dataIndex="name" />
      <a-table-column title="Platform" dataIndex="platformType" />
      <a-table-column title="Status" dataIndex="status" />
      <a-table-column title="Feishu Workspace" dataIndex="feishuWorkspaceId" />
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

    <a-modal
      v-model:open="modalOpen"
      :title="modalMode === 'create' ? 'New Integration' : 'Edit Integration'"
      :confirmLoading="loading"
      @ok="submit"
    >
      <a-form layout="vertical">
        <a-form-item label="Name">
          <a-input v-model:value="formName" />
        </a-form-item>

        <a-form-item label="Platform Type">
          <a-input-number v-model:value="formPlatformType" :min="0" style="width: 100%" />
        </a-form-item>

        <a-form-item label="Status">
          <a-select v-model:value="formStatus">
            <a-select-option value="connected">connected</a-select-option>
            <a-select-option value="invalid">invalid</a-select-option>
            <a-select-option value="disabled">disabled</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="Feishu Workspace Id">
          <a-input v-model:value="formFeishuWorkspaceId" />
        </a-form-item>

        <a-form-item label="Config (JSON)">
          <a-textarea v-model:value="formConfigJson" :rows="6" />
        </a-form-item>

        <a-form-item label="Access Token (optional)">
          <a-input v-model:value="formAccessToken" />
        </a-form-item>

        <a-form-item label="Refresh Token (optional)">
          <a-input v-model:value="formRefreshToken" />
        </a-form-item>

        <a-form-item label="Expires At (optional, ISO string)">
          <a-input v-model:value="formExpiresAt" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-space>
</template>
