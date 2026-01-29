<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  platformDeleteWorkspaceMember,
  platformListWorkspaceMembers,
  platformUpsertWorkspaceMember,
  type PlatformWorkspaceMember,
} from '@/apis/platform'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()
const workspaceId = computed(() => Number(route.params.id))

const loading = ref(false)
const saving = ref(false)

const members = ref<PlatformWorkspaceMember[]>([])

const recordsPage = ref(1)
const recordsPageSize = ref(20)
const email = ref('')
const name = ref('')
const role = ref<string | undefined>(undefined)

const filteredMembers = computed(() => {
  const emailQ = email.value.trim().toLowerCase()
  const nameQ = name.value.trim().toLowerCase()
  const roleQ = (role.value ?? '').trim().toLowerCase()

  return members.value.filter((m) => {
    if (emailQ && !String(m.email ?? '').toLowerCase().includes(emailQ)) return false
    if (nameQ && !String(m.name ?? '').toLowerCase().includes(nameQ)) return false
    if (roleQ && String(m.role ?? '').toLowerCase() !== roleQ) return false
    return true
  })
})

const recordsTotal = computed(() => filteredMembers.value.length)

const dataSource = computed(() => {
  const start = (recordsPage.value - 1) * recordsPageSize.value
  return filteredMembers.value.slice(start, start + recordsPageSize.value)
})

const load = async () => {
  if (!Number.isFinite(workspaceId.value)) {
    message.error(t('error.invalidWorkspaceId'))
    return
  }

  loading.value = true
  try {
    const res = await platformListWorkspaceMembers(workspaceId.value)
    members.value = res
    recordsPage.value = 1
  } finally {
    loading.value = false
  }
}

const onRecordsPaginationChange = async (page: number, pageSize?: number) => {
  recordsPage.value = page
  if (pageSize) recordsPageSize.value = pageSize
}

const search = async () => {
  recordsPage.value = 1
  await load()
}

const resetSearch = async () => {
  email.value = ''
  name.value = ''
  role.value = undefined
  recordsPage.value = 1
  await load()
}

const inviteOpen = ref(false)
const inviteEmail = ref('')
const inviteName = ref('')
const inviteRole = ref('member')
const invitePassword = ref('')

const openInvite = () => {
  inviteEmail.value = ''
  inviteName.value = ''
  inviteRole.value = 'member'
  invitePassword.value = ''
  inviteOpen.value = true
}

const submitInvite = async () => {
  if (!Number.isFinite(workspaceId.value)) {
    message.error(t('error.invalidWorkspaceId'))
    return
  }
  if (!inviteEmail.value.trim()) {
    message.error(t('error.emailRequired'))
    return
  }

  saving.value = true
  try {
    await platformUpsertWorkspaceMember(workspaceId.value, {
      email: inviteEmail.value.trim(),
      name: inviteName.value.trim() ? inviteName.value.trim() : null,
      role: inviteRole.value,
      password: invitePassword.value.trim() ? invitePassword.value : undefined,
    })
    message.success('member invited')
    inviteOpen.value = false
    await load()
  } finally {
    saving.value = false
  }
}

const editOpen = ref(false)
const editUserId = ref<number | null>(null)
const editEmail = ref('')
const editName = ref('')
const editRole = ref('member')
const editPassword = ref('')

const openEdit = (row: PlatformWorkspaceMember) => {
  editUserId.value = row.userId
  editEmail.value = row.email
  editName.value = row.name ?? ''
  editRole.value = row.role
  editPassword.value = ''
  editOpen.value = true
}

const submitEdit = async () => {
  if (!Number.isFinite(workspaceId.value)) {
    message.error(t('error.invalidWorkspaceId'))
    return
  }
  if (!editEmail.value.trim()) {
    message.error(t('error.emailRequired'))
    return
  }

  saving.value = true
  try {
    await platformUpsertWorkspaceMember(workspaceId.value, {
      email: editEmail.value.trim(),
      name: editName.value.trim() ? editName.value.trim() : null,
      role: editRole.value,
      password: editPassword.value.trim() ? editPassword.value : undefined,
    })
    message.success(t('success.memberUpdated'))
    editOpen.value = false
    await load()
  } finally {
    saving.value = false
  }
}

const doDelete = async (row: PlatformWorkspaceMember) => {
  if (!Number.isFinite(workspaceId.value)) {
    message.error(t('error.invalidWorkspaceId'))
    return
  }

  saving.value = true
  try {
    await platformDeleteWorkspaceMember(workspaceId.value, row.userId)
    message.success('deleted')
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <a-card size="small" direction="vertical">
      <a-space style="width: 100%; justify-content: space-between">
        <div style="font-size: 18px; font-weight: 600">Platform / Workspace #{{ route.params.id }} Members</div>
        <a-button type="primary" @click="openInvite">Invite</a-button>
      </a-space>
      <a-space style="width: 100%" wrap :size="8">
        <a-input v-model:value="email" placeholder="user email" style="width: 220px" />
        <a-input v-model:value="name" placeholder="name (optional)" style="width: 180px" />
        <a-select v-model:value="role" allowClear style="width: 140px" placeholder="role">
          <a-select-option value="owner">owner</a-select-option>
          <a-select-option value="admin">admin</a-select-option>
          <a-select-option value="member">member</a-select-option>
          <a-select-option value="viewer">viewer</a-select-option>
        </a-select>
        <a-button :loading="loading" @click="resetSearch">Reset</a-button>
      </a-space>
    </a-card>

    <a-card size="small">
      <a-table
        :dataSource="dataSource"
        rowKey="userId"
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
      >
        <a-table-column :title="$t('platformWorkspaceMembers.userId')" dataIndex="userId" />
        <a-table-column :title="$t('platformWorkspaceMembers.email')" dataIndex="email" />
        <a-table-column :title="$t('platformWorkspaceMembers.name')" dataIndex="name" />
        <a-table-column :title="$t('platformWorkspaceMembers.role')" dataIndex="role" />
        <a-table-column :title="$t('platformWorkspaceMembers.createdAt')" dataIndex="createdAt" />
        <a-table-column :title="$t('platformWorkspaceMembers.actions')">
          <template #default="{ record }">
            <a-space :size="8">
              <a-button size="small" @click.stop="openEdit(record as any)">{{ $t('platformWorkspaceMembers.edit') }}</a-button>
              <a-popconfirm :title="$t('platformWorkspaceMembers.deleteConfirm')" @confirm="doDelete(record as any)">
                <a-button size="small" danger @click.stop>{{ $t('platformWorkspaceMembers.delete') }}</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table-column>
      </a-table>
    </a-card>

    <a-modal v-model:open="editOpen" title="Edit Member" :confirmLoading="saving" @ok="submitEdit">
      <a-form layout="vertical">
        <a-form-item label="Email" required>
          <a-input v-model:value="editEmail" />
        </a-form-item>
        <a-form-item label="Name">
          <a-input v-model:value="editName" />
        </a-form-item>
        <a-form-item label="Role" required>
          <a-select v-model:value="editRole">
            <a-select-option value="owner">owner</a-select-option>
            <a-select-option value="admin">admin</a-select-option>
            <a-select-option value="member">member</a-select-option>
            <a-select-option value="viewer">viewer</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Password">
          <a-input-password v-model:value="editPassword" placeholder="Leave empty to keep unchanged" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="inviteOpen" title="Invite Member" :confirmLoading="saving" @ok="submitInvite">
      <a-form layout="vertical">
        <a-form-item label="Email" required>
          <a-input v-model:value="inviteEmail" />
        </a-form-item>
        <a-form-item label="Name">
          <a-input v-model:value="inviteName" />
        </a-form-item>
        <a-form-item label="Role" required>
          <a-select v-model:value="inviteRole">
            <a-select-option value="owner">owner</a-select-option>
            <a-select-option value="admin">admin</a-select-option>
            <a-select-option value="member">member</a-select-option>
            <a-select-option value="viewer">viewer</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('platformWorkspaceMembers.password')">
          <a-input-password v-model:value="invitePassword" placeholder="Optional" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-space>
</template>
