<script setup lang="ts">
import { getOssSettings, updateOssSettings, type WorkspaceOssConfig } from '@/apis/settings'
import { message } from 'ant-design-vue'
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const ossLoading = ref(false)
const ossValue = ref<WorkspaceOssConfig>({
  region: '',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
  endpoint: '',
  publicBaseUrl: '',
})

const auth = useAuthStore()

const loadOss = async () => {
  ossLoading.value = true
  try {
    const res = await getOssSettings()
    if (res) {
      ossValue.value = {
        region: res.region,
        accessKeyId: res.accessKeyId,
        accessKeySecret: res.accessKeySecret,
        bucket: res.bucket,
        endpoint: res.endpoint ?? '',
        publicBaseUrl: res.publicBaseUrl ?? '',
      }
    } else {
      ossValue.value = {
        region: '',
        accessKeyId: '',
        accessKeySecret: '',
        bucket: '',
        endpoint: '',
        publicBaseUrl: '',
      }
    }
    message.success('Loaded')
  } finally {
    ossLoading.value = false
  }
}

const saveOss = async () => {
  ossLoading.value = true
  try {
    const payload: WorkspaceOssConfig = {
      region: ossValue.value.region,
      accessKeyId: ossValue.value.accessKeyId,
      accessKeySecret: ossValue.value.accessKeySecret,
      bucket: ossValue.value.bucket,
      endpoint: ossValue.value.endpoint?.trim() ? ossValue.value.endpoint : undefined,
      publicBaseUrl: ossValue.value.publicBaseUrl?.trim() ? ossValue.value.publicBaseUrl : undefined,
    }
    const res = await updateOssSettings(payload)
    if (res) {
      ossValue.value = {
        region: res.region,
        accessKeyId: res.accessKeyId,
        accessKeySecret: res.accessKeySecret,
        bucket: res.bucket,
        endpoint: res.endpoint ?? '',
        publicBaseUrl: res.publicBaseUrl ?? '',
      }
    }
    message.success('Saved')
  } finally {
    ossLoading.value = false
  }
}

onMounted(() => {
  void loadOss()
})

watch(
  () => auth.activeWorkspaceId,
  () => {
    void loadOss()
  },
)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <div style="font-size: 18px; font-weight: 600">Settings / OSS</div>

    <a-form layout="vertical">
      <a-form-item label="Region">
        <a-input v-model:value="ossValue.region" placeholder="oss-cn-hangzhou" />
      </a-form-item>
      <a-form-item label="AccessKeyId">
        <a-input v-model:value="ossValue.accessKeyId" placeholder="LTAI..." />
      </a-form-item>
      <a-form-item label="AccessKeySecret">
        <a-input-password v-model:value="ossValue.accessKeySecret" placeholder="********" />
      </a-form-item>
      <a-form-item label="Bucket">
        <a-input v-model:value="ossValue.bucket" placeholder="your-bucket" />
      </a-form-item>
      <a-form-item label="Endpoint (optional)">
        <a-input v-model:value="ossValue.endpoint" placeholder="https://oss-cn-hangzhou.aliyuncs.com" />
      </a-form-item>
      <a-form-item label="PublicBaseUrl (optional)">
        <a-input v-model:value="ossValue.publicBaseUrl" placeholder="https://cdn.example.com" />
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button :loading="ossLoading" @click="loadOss">Load</a-button>
          <a-button type="primary" :loading="ossLoading" @click="saveOss">Save</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-space>
</template>
