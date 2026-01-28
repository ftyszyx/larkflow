<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const selectedKeys = computed(() => {
  if (route.path.startsWith("/platform/workspaces/") && route.path !== "/platform/workspaces") return ["/platform/members"];
  return [route.path];
});

const openKeys = computed(() => {
  if (route.path.startsWith("/settings")) return ["settings"];
  return [];
});

const showPlatform = computed(() => !!auth.user?.isPlatformAdmin);

const displayName = computed(() => {
  const u = auth.user;
  if (!u) return "Unknown";
  return u.name?.trim() || u.email;
});

const displayRole = computed(() => (auth.user?.isPlatformAdmin ? "Platform Admin" : "User"));

const onMenuClick = (e: any) => {
  const key = String(e?.key ?? "");
  if (key === "/platform/members") {
    const id = String(route.params?.id ?? "").trim();
    if (id) {
      router.push(`/platform/workspaces/${id}`);
    } else {
      //current workspace
      router.push(`/platform/workspaces/${auth.activeWorkspaceId}`);
    }
    return;
  }
  router.push(key);
};

const onUserMenuClick = (info: any) => {
  const key = String(info?.key ?? "");
  if (key === "logout") {
    auth.clearSession();
    router.push("/login");
  } else if (key === "switch-workspace") {
    router.push({ path: "/select-workspace", query: { force: "1" } });
  }
};
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider collapsible>
      <div style="height: 32px; margin: 16px; color: #fff; font-weight: 600">larkflow</div>
      <a-menu theme="dark" mode="inline" :selectedKeys="selectedKeys" :openKeys="openKeys" @click="onMenuClick">
        <a-menu-item v-if="showPlatform" key="/platform/workspaces">Platform</a-menu-item>
        <a-menu-item  key="/platform/members">Members</a-menu-item>
        <a-menu-item key="/integrations">Integrations</a-menu-item>
        <a-menu-item key="/sync">Sync</a-menu-item>
        <a-menu-item key="/jobs">Jobs</a-menu-item>
        <a-menu-item key="/articles">Articles</a-menu-item>
        <a-sub-menu key="settings" title="Settings">
          <a-menu-item key="/settings/oss">OSS</a-menu-item>
          <a-menu-item v-if="showPlatform" key="/settings/worker">Worker</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header style="background: #fff; padding: 0 16px">
        <div style="display: flex; align-items: center; justify-content: space-between; height: 100%">
          <div style="color: #666">Workspace: {{ auth.activeWorkspaceId || "-" }}</div>
          <a-dropdown placement="bottomRight" :trigger="['click']">
            <span style="display: flex; align-items: center; gap: 8px; cursor: pointer">
              <a-avatar size="small">{{ displayName.slice(0, 1).toUpperCase() }}</a-avatar>
              <span style="color: #333">{{ displayName }}</span>
              <span style="color: #999; font-size: 12px">({{ displayRole }})</span>
            </span>
            <template #overlay>
              <a-menu @click="onUserMenuClick">
                <a-menu-item key="switch-workspace">Switch Workspace</a-menu-item>
                <a-menu-item key="logout">Logout</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>
      <a-layout-content style="margin: 16px">
        <div style="background: #fff; padding: 16px; min-height: calc(100vh - 112px)">
          <RouterView />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
