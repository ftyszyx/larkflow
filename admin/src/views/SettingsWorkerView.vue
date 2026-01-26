<script setup lang="ts">
import { getWorkerSettings, updateWorkerSettings, type WorkerSettingsValue } from '@/apis'
import { message } from 'ant-design-vue'
import { onMounted, ref } from 'vue'

const loading = ref(false)
const value = ref<WorkerSettingsValue>({
  concurrency: 1,
  pollMs: 1000,
  lockSeconds: 30,
})

const load = async () => {
  loading.value = true
  try {
    const res = await getWorkerSettings()
    if (res) {
      value.value = res
    }
    message.success('Loaded')
  } finally {
    loading.value = false
  }
}

const save = async () => {
  loading.value = true
  try {
    const res = await updateWorkerSettings(value.value)
    if (res) {
      value.value = res
    }
    message.success('Saved')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <a-space direction="vertical" style="width: 100%" :size="16">
    <div style="font-size: 18px; font-weight: 600">Settings / Worker</div>

    <a-form layout="vertical">
      <a-form-item label="Concurrency">
        <a-input-number v-model:value="value.concurrency" :min="1" style="width: 240px" />
      </a-form-item>
      <a-form-item label="Poll Ms">
        <a-input-number v-model:value="value.pollMs" :min="50" style="width: 240px" />
      </a-form-item>
      <a-form-item label="Lock Seconds">
        <a-input-number v-model:value="value.lockSeconds" :min="1" style="width: 240px" />
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
