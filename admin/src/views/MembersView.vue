<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createInvitation } from '@/apis/invitations'
import { listMembers, updateMemberRole, type WorkspaceMember } from '@/apis/members'

const loading = ref(false)
const saving = ref(false)

const members = ref<WorkspaceMember[]>([])
const dataSource = computed(() => members.value)

const inviteEmail = ref('')
const inviteRole = ref('member')
const inviteDays = ref<number>(7)

const lastInviteToken = ref('')
const lastInviteExpiresAt = ref('')

const load = async () => {
  loading.value = true
  try {
    const res = await listMembers()
    members.value = res.data
  } finally {
    loading.value = false
  }
}

const invite = async () => {
  if (!inviteEmail.value.trim()) {
    message.error('email is required')
    return
  }

  saving.value = true
  try {
    const res = await createInvitation({
      email: inviteEmail.value.trim(),
      role: inviteRole.value,
      expiresInDays: inviteDays.value,
    })
    lastInviteToken.value = res.data.token
    lastInviteExpiresAt.value = res.data.expiresAt
    message.success('invitation created')
  } finally {
    saving.value = false
  }
}

const changeRole = async (userId: number, role: string) => {
  saving.value = true
  try {
    await updateMemberRole(userId, role)
    message.success('role updated')
    await load()
  } finally {
    saving.value = false
  }
}

const copyToken = async () => {
  if (!lastInviteToken.value) return
  await navigator.clipboard.writeText(lastInviteToken.value)
  message.success('token copied')
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-card title="Workspace / Members" size="small">
      <a-space wrap :size="8">
        <a-input v-model:value="inviteEmail" placeholder="invite email" style="width: 220px" />
        <a-select v-model:value="inviteRole" style="width: 140px">
          <a-select-option value="owner">owner</a-select-option>
          <a-select-option value="admin">admin</a-select-option>
          <a-select-option value="member">member</a-select-option>
          <a-select-option value="viewer">viewer</a-select-option>
        </a-select>
        <a-input-number v-model:value="inviteDays" :min="1" :max="30" style="width: 120px" />
        <a-button type="primary" :loading="saving" @click="invite">Create Invite</a-button>
        <a-button :loading="loading" @click="load">Refresh</a-button>
      </a-space>

      <div v-if="lastInviteToken" style="margin-top: 12px">
        <div style="color: #999; font-size: 12px">Token (send to user):</div>
        <a-space :size="8">
          <a-input :value="lastInviteToken" readonly style="width: 520px" />
          <a-button @click="copyToken">Copy</a-button>
        </a-space>
        <div style="color: #999; font-size: 12px; margin-top: 4px">ExpiresAt: {{ lastInviteExpiresAt }}</div>
      </div>
    </a-card>

    <a-card size="small">
      <a-table :dataSource="dataSource" rowKey="userId" size="small" :loading="loading" :pagination="false">
        <a-table-column title="UserId" dataIndex="userId" />
        <a-table-column title="Email" dataIndex="email" />
        <a-table-column title="Name" dataIndex="name" />
        <a-table-column title="Role" dataIndex="role">
          <template #default="{ record }">
            <a-select
              :value="(record as any).role"
              style="width: 120px"
              @change="(v: string) => changeRole((record as any).userId, v)"
            >
              <a-select-option value="owner">owner</a-select-option>
              <a-select-option value="admin">admin</a-select-option>
              <a-select-option value="member">member</a-select-option>
              <a-select-option value="viewer">viewer</a-select-option>
            </a-select>
          </template>
        </a-table-column>
        <a-table-column title="Created" dataIndex="createdAt" />
      </a-table>
    </a-card>
  </a-space>
</template>
