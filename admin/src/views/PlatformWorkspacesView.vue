<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { platformCreateWorkspace, platformListWorkspaces, type PlatformWorkspace } from '@/apis/platform'

const router = useRouter()

const loading = ref(false)
const creating = ref(false)
const createName = ref('')

const items = ref<PlatformWorkspace[]>([])

const dataSource = computed(() => items.value)

const load = async () => {
  loading.value = true
  try {
    const res = await platformListWorkspaces()
    items.value = res.data
  } finally {
    loading.value = false
  }
}

const create = async () => {
  if (!createName.value.trim()) {
    message.error('name is required')
    return
  }

  creating.value = true
  try {
    const res = await platformCreateWorkspace(createName.value.trim())
    message.success('workspace created')
    createName.value = ''
    items.value = [res.data, ...items.value]
  } finally {
    creating.value = false
  }
}

const goMembers = (id: number) => {
  router.push(`/platform/workspaces/${id}`)
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-card title="Platform / Workspaces" size="small">
      <a-space style="width: 100%" :size="8">
        <a-input v-model:value="createName" placeholder="New workspace name" style="max-width: 320px" />
        <a-button type="primary" :loading="creating" @click="create">Create</a-button>
        <a-button :loading="loading" @click="load">Refresh</a-button>
      </a-space>
    </a-card>

    <a-card size="small">
      <a-table
        :dataSource="dataSource"
        rowKey="id"
        size="small"
        :loading="loading"
        :pagination="false"
        :customRow="(record: unknown) => ({ onClick: () => goMembers((record as { id: number }).id) })"
      >
        <a-table-column title="ID" dataIndex="id" />
        <a-table-column title="Name" dataIndex="name" />
        <a-table-column title="Updated" dataIndex="updatedAt" />
      </a-table>
      <div style="color: #999; font-size: 12px; margin-top: 8px">
        Click a row to manage workspace members.
      </div>
    </a-card>
  </a-space>
</template>
