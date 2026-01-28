<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  platformCreateWorkspace,
  platformDeleteWorkspace,
  platformListWorkspaces,
  platformUpdateWorkspace,
  type PlatformWorkspace,
} from '@/apis/platform'

const router = useRouter()

const loading = ref(false)
const creating = ref(false)
const saving = ref(false)

const searchName = ref('')

const items = ref<PlatformWorkspace[]>([])

const recordsPage = ref(1)
const recordsPageSize = ref(20)
const filteredItems = computed(() => {
  const q = searchName.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((w) => String(w.name ?? '').toLowerCase().includes(q) || String(w.id).includes(q))
})

const recordsTotal = computed(() => filteredItems.value.length)

const dataSource = computed(() => {
  const start = (recordsPage.value - 1) * recordsPageSize.value
  return filteredItems.value.slice(start, start + recordsPageSize.value)
})

const load = async () => {
  loading.value = true
  try {
    const res = await platformListWorkspaces()
    items.value = res
    recordsPage.value = 1
  } finally {
    loading.value = false
  }
}

const search = async () => {
  recordsPage.value = 1
  await load()
}

const resetSearch = async () => {
  searchName.value = ''
  recordsPage.value = 1
  await load()
}

const createOpen = ref(false)
const createName = ref('')

const openCreate = () => {
  createName.value = ''
  createOpen.value = true
}

const submitCreate = async () => {
  if (!createName.value.trim()) {
    message.error('name is required')
    return
  }
  creating.value = true
  try {
    await platformCreateWorkspace(createName.value.trim())
    message.success('workspace created')
    createOpen.value = false
    await load()
  } finally {
    creating.value = false
  }
}

const editOpen = ref(false)
const editId = ref<number | null>(null)
const editName = ref('')

const openEdit = (row: PlatformWorkspace) => {
  editId.value = row.id
  editName.value = row.name
  editOpen.value = true
}

const submitEdit = async () => {
  if (!editId.value) return
  if (!editName.value.trim()) {
    message.error('name is required')
    return
  }
  saving.value = true
  try {
    await platformUpdateWorkspace(editId.value, editName.value.trim())
    message.success('updated')
    editOpen.value = false
    await load()
  } finally {
    saving.value = false
  }
}

const doDelete = async (row: PlatformWorkspace) => {
  saving.value = true
  try {
    await platformDeleteWorkspace(row.id)
    message.success('deleted')
    await load()
  } finally {
    saving.value = false
  }
}

const onRecordsPaginationChange = async (page: number, pageSize?: number) => {
  recordsPage.value = page
  if (pageSize) recordsPageSize.value = pageSize
}

const goMembers = (id: number) => {
  router.push(`/platform/workspaces/${id}`)
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-card size="small" direction="vertical">
      <a-space style="width: 100%; justify-content: space-between;">
        <div style="font-size: 18px; font-weight: 600">Platform / Workspaces</div>
        <a-button type="primary" @click="openCreate">Create</a-button>
      </a-space>
      <a-space style="width: 100%" :size="8">
        <a-input v-model:value="searchName" placeholder="Search by name/id" style="max-width: 320px" />
        <a-button :loading="loading" @click="resetSearch">Reset</a-button>
      </a-space>
    </a-card>

    <a-card size="small">
      <a-table
        :dataSource="dataSource"
        rowKey="id"
        size="small"
        :loading="loading"
        :pagination="{
          current: recordsPage,
          pageSize: recordsPageSize,
          total: recordsTotal,
          showSizeChanger: true,
          onChange: onRecordsPaginationChange,
          onShowSizeChange: onRecordsPaginationChange,
        }"
        :customRow="(record: unknown) => ({ onClick: () => goMembers((record as { id: number }).id) })"
      >
        <a-table-column title="ID" dataIndex="id" />
        <a-table-column title="Name" dataIndex="name" />
        <a-table-column title="Updated" dataIndex="updatedAt" />
        <a-table-column title="Actions">
          <template #default="{ record }">
            <a-space :size="8">
              <a-button size="small" @click.stop="openEdit(record as any)">Edit</a-button>
              <a-popconfirm title="Delete this workspace?" @confirm="doDelete(record as any)">
                <a-button size="small" danger @click.stop>Delete</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table-column>
      </a-table>
    </a-card>

    <a-modal v-model:open="createOpen" title="New Workspace" :confirmLoading="creating" @ok="submitCreate">
      <a-form layout="vertical">
        <a-form-item label="Name" required>
          <a-input v-model:value="createName" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editOpen" title="Edit Workspace" :confirmLoading="saving" @ok="submitEdit">
      <a-form layout="vertical">
        <a-form-item label="Name" required>
          <a-input v-model:value="editName" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-space>
</template>
