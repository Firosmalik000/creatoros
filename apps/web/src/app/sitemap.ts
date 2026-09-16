import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: `${siteConfig.origin}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: locale === "id" ? 1 : 0.9,
    alternates: {
      languages: {
        "id-ID": `${siteConfig.origin}/id`,
        en: `${siteConfig.origin}/en`,
        "ms-MY": `${siteConfig.origin}/ms`,
      },
    },
  }));
}
