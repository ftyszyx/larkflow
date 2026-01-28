import { defineStore } from "pinia";
import { ref, watch } from "vue";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import enUS from "ant-design-vue/es/locale/en_US";
import { i18n } from "@/utils/i18n";

export type SupportedLocale = "en" | "zh-cn";

export const useLocaleStore = defineStore("locale", () => {
  const current = ref<SupportedLocale>((localStorage.getItem("locale") as SupportedLocale) || "zh-cn");

  const setLocale = (loc: SupportedLocale) => {
    current.value = loc;
  };

  watch(
    current,
    (loc: SupportedLocale) => {
      localStorage.setItem("locale", loc);
      if (i18n.global && "locale" in i18n.global) {
        (i18n.global as any).locale.value = loc;
      }
    },
    { immediate: true },
  );

  const antdLocale = () => (current.value === "zh-cn" ? zhCN : enUS);

  return { current, setLocale, antdLocale };
});
