<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  platformListWorkspaceMembers,
  platformUpsertWorkspaceMember,
  type PlatformWorkspaceMember,
} from '@/apis/platform'

const route = useRoute()

const workspaceId = computed(() => Number(route.params.id))

const loading = ref(false)
const saving = ref(false)

const members = ref<PlatformWorkspaceMember[]>([])

const email = ref('')
const name = ref('')
const role = ref('member')
const password = ref('')

const dataSource = computed(() => members.value)

const load = async () => {
  if (!Number.isFinite(workspaceId.value)) {
    message.error('invalid workspace id')
    return
  }

  loading.value = true
  try {
    const res = await platformListWorkspaceMembers(workspaceId.value)
    members.value = res.data
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!Number.isFinite(workspaceId.value)) {
    message.error('invalid workspace id')
    return
  }
  if (!email.value.trim()) {
    message.error('email is required')
    return
  }

  saving.value = true
  try {
    await platformUpsertWorkspaceMember(workspaceId.value, {
      email: email.value.trim(),
      name: name.value.trim() ? name.value.trim() : null,
      role: role.value,
      password: password.value.trim() ? password.value : undefined,
    })
    message.success('member updated')
    password.value = ''
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-card :title="`Platform / Workspace #${route.params.id} Members`" size="small">
      <a-space style="width: 100%" wrap :size="8">
        <a-input v-model:value="email" placeholder="user email" style="width: 220px" />
        <a-input v-model:value="name" placeholder="name (optional)" style="width: 180px" />
        <a-select v-model:value="role" style="width: 140px">
          <a-select-option value="owner">owner</a-select-option>
          <a-select-option value="admin">admin</a-select-option>
          <a-select-option value="member">member</a-select-option>
          <a-select-option value="viewer">viewer</a-select-option>
        </a-select>
        <a-input-password v-model:value="password" placeholder="password (optional)" style="width: 200px" />
        <a-button type="primary" :loading="saving" @click="save">Upsert</a-button>
        <a-button :loading="loading" @click="load">Refresh</a-button>
      </a-space>
      <div style="color: #999; font-size: 12px; margin-top: 8px">
        Upsert will create user if missing and set role in this workspace. Password is optional.
      </div>
    </a-card>

    <a-card size="small">
      <a-table :dataSource="dataSource" rowKey="userId" size="small" :loading="loading" :pagination="false">
        <a-table-column title="UserId" dataIndex="userId" />
        <a-table-column title="Email" dataIndex="email" />
        <a-table-column title="Name" dataIndex="name" />
        <a-table-column title="Role" dataIndex="role" />
        <a-table-column title="Created" dataIndex="createdAt" />
      </a-table>
    </a-card>
  </a-space>
</template>
