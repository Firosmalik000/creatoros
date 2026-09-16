import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["id", "en", "ms"],
  defaultLocale: "id",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const htmlLanguage: Record<AppLocale, string> = {
  id: "id-ID",
  en: "en",
  ms: "ms-MY",
};
