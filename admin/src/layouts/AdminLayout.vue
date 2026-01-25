<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const selectedKeys = computed(() => [route.path])

const onMenuClick = (e: any) => {
  router.push(e.key)
}
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider collapsible>
      <div style="height: 32px; margin: 16px; color: #fff; font-weight: 600">larkflow</div>
      <a-menu theme="dark" mode="inline" :selectedKeys="selectedKeys" @click="onMenuClick">
        <a-menu-item key="/settings">Settings</a-menu-item>
        <a-menu-item key="/integrations">Integrations</a-menu-item>
        <a-menu-item key="/sync">Sync</a-menu-item>
        <a-menu-item key="/articles">Articles</a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header style="background: #fff; padding: 0 16px" />
      <a-layout-content style="margin: 16px">
        <div style="background: #fff; padding: 16px; min-height: calc(100vh - 112px)">
          <RouterView />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
