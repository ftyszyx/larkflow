<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { me } from '@/apis/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const loading = ref(false)

const dataSource = computed(() => auth.workspaces)

const load = async () => {
  loading.value = true
  try {
    const res = await me()
    auth.user = res.data.user
    auth.workspaces = res.data.workspaces

    const force = String(route.query.force ?? '') === '1'
    if (!force && auth.workspaces.length === 1) {
      auth.setActiveWorkspace(auth.workspaces[0].id)
      router.push('/integrations')
    }
  } finally {
    loading.value = false
  }
}

const select = async (id: number) => {
  auth.setActiveWorkspace(id)
  message.success('workspace selected')
  router.push('/integrations')
}

onMounted(load)
</script>

<template>
  <div style="max-width: 720px; margin: 80px auto">
    <a-space direction="vertical" style="width: 100%" :size="16">
      <a-card title="Select Workspace" size="small">
        <a-table :dataSource="dataSource" :loading="loading" rowKey="id" size="small" :pagination="false"
          :customRow="(record: unknown) => ({ onClick: () => select((record as { id: number }).id) })"
        >
          <a-table-column title="ID" dataIndex="id" />
          <a-table-column title="Name" dataIndex="name" />
          <a-table-column title="Role" dataIndex="role" />
        </a-table>
      </a-card>
    </a-space>
  </div>
</template>
