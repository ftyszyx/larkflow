<template>
  <a-config-provider :locale="localeStore.antdLocale()">
    <RouterView />
  </a-config-provider>
</template>

<script setup lang="ts">
import { useLocaleStore } from "./stores/locale";

const localeStore = useLocaleStore();
</script>
