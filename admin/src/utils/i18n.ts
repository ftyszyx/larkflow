import { createI18n } from "vue-i18n";
import enUS from "@/i18n/locales/en-US";
import zhCN from "@/i18n/locales/zh-CN";

export const i18n = createI18n({
  legacy: false,
  locale: (globalThis.localStorage?.getItem("locale") as "en" | "zh-cn") || "zh-cn",
  fallbackLocale: "zh-cn",
  messages: { en: enUS, "zh-cn": zhCN },
});
