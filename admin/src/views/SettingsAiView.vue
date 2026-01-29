<script setup lang="ts">
import { getAiSettings, updateAiSettings, type WorkspaceAiSettingsValue } from '@/apis/settings'
import { message } from 'ant-design-vue'
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const loading = ref(false)
const value = ref<WorkspaceAiSettingsValue>({
  grsChat: {
    apiKey: '',
    baseUrl: '',
    model: '',
  },
  nanoBanana: {
    apiKey: '',
    baseUrl: '',
    model: '',
    imageSize: '1K',
    aspectRatio: 'auto',
  },
})

const auth = useAuthStore()

const load = async () => {
  loading.value = true
  try {
    const res = await getAiSettings()
    value.value = {
      grsChat: {
        apiKey: res?.grsChat?.apiKey ?? '',
        baseUrl: res?.grsChat?.baseUrl ?? '',
        model: res?.grsChat?.model ?? '',
      },
      nanoBanana: {
        apiKey: res?.nanoBanana?.apiKey ?? '',
        baseUrl: res?.nanoBanana?.baseUrl ?? '',
        model: res?.nanoBanana?.model ?? '',
        imageSize: res?.nanoBanana?.imageSize ?? '1K',
        aspectRatio: res?.nanoBanana?.aspectRatio ?? 'auto',
      },
    }
    message.success('Loaded')
  } finally {
    loading.value = false
  }
}

const save = async () => {
  loading.value = true
  try {
    const payload: WorkspaceAiSettingsValue = {
      grsChat: {
        apiKey: value.value.grsChat?.apiKey?.trim() ? value.value.grsChat?.apiKey : undefined,
        baseUrl: value.value.grsChat?.baseUrl?.trim() ? value.value.grsChat?.baseUrl : undefined,
        model: value.value.grsChat?.model?.trim() ? value.value.grsChat?.model : undefined,
      },
      nanoBanana: {
        apiKey: value.value.nanoBanana?.apiKey?.trim() ? value.value.nanoBanana?.apiKey : undefined,
        baseUrl: value.value.nanoBanana?.baseUrl?.trim() ? value.value.nanoBanana?.baseUrl : undefined,
        model: value.value.nanoBanana?.model?.trim() ? value.value.nanoBanana?.model : undefined,
        imageSize: value.value.nanoBanana?.imageSize,
        aspectRatio: value.value.nanoBanana?.aspectRatio?.trim() ? value.value.nanoBanana?.aspectRatio : undefined,
      },
    }

    const res = await updateAiSettings(payload)
    value.value = {
      grsChat: {
        apiKey: res?.grsChat?.apiKey ?? '',
        baseUrl: res?.grsChat?.baseUrl ?? '',
        model: res?.grsChat?.model ?? '',
      },
      nanoBanana: {
        apiKey: res?.nanoBanana?.apiKey ?? '',
        baseUrl: res?.nanoBanana?.baseUrl ?? '',
        model: res?.nanoBanana?.model ?? '',
        imageSize: res?.nanoBanana?.imageSize ?? '1K',
        aspectRatio: res?.nanoBanana?.aspectRatio ?? 'auto',
      },
    }
    message.success('Saved')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

watch(
  () => auth.activeWorkspaceId,
  () => {
    void load()
  },
)
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <div style="font-size: 18px; font-weight: 600">Settings / AI</div>

    <a-form layout="vertical">
      <a-divider orientation="left">GRS Chat</a-divider>

      <a-form-item label="API Key">
        <a-input-password v-model:value="value.grsChat!.apiKey" placeholder="Bearer apikey" />
      </a-form-item>
      <a-form-item label="Base URL (optional)">
        <a-input v-model:value="value.grsChat!.baseUrl" placeholder="https://grsaiapi.com" />
      </a-form-item>
      <a-form-item label="Default Model (optional)">
        <a-input v-model:value="value.grsChat!.model" placeholder="gemini-3-pro" />
      </a-form-item>

      <a-divider orientation="left">Nano-Banana</a-divider>

      <a-form-item label="API Key">
        <a-input-password v-model:value="value.nanoBanana!.apiKey" placeholder="Bearer apikey" />
      </a-form-item>
      <a-form-item label="Base URL (optional)">
        <a-input v-model:value="value.nanoBanana!.baseUrl" placeholder="https://grsai.dakka.com.cn" />
      </a-form-item>
      <a-form-item label="Default Model (optional)">
        <a-input v-model:value="value.nanoBanana!.model" placeholder="nano-banana-fast" />
      </a-form-item>
      <a-form-item label="Image Size">
        <a-select v-model:value="value.nanoBanana!.imageSize" style="width: 200px">
          <a-select-option value="1K">1K</a-select-option>
          <a-select-option value="2K">2K</a-select-option>
          <a-select-option value="4K">4K</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Aspect Ratio">
        <a-select v-model:value="value.nanoBanana!.aspectRatio" style="width: 200px">
          <a-select-option value="auto">auto</a-select-option>
          <a-select-option value="1:1">1:1</a-select-option>
          <a-select-option value="16:9">16:9</a-select-option>
          <a-select-option value="9:16">9:16</a-select-option>
          <a-select-option value="4:3">4:3</a-select-option>
          <a-select-option value="3:4">3:4</a-select-option>
          <a-select-option value="3:2">3:2</a-select-option>
          <a-select-option value="2:3">2:3</a-select-option>
          <a-select-option value="5:4">5:4</a-select-option>
          <a-select-option value="4:5">4:5</a-select-option>
          <a-select-option value="21:9">21:9</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button :loading="loading" @click="load">Load</a-button>
          <a-button type="primary" :loading="loading" @click="save">Save</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-space>
</template>
