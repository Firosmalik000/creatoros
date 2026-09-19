import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries = routing.locales.flatMap((locale) => [
    {
      url: `${siteConfig.origin}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: locale === "id" ? 1 : 0.9,
    },
    {
      url: `${siteConfig.origin}/${locale}/creators`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: locale === "id" ? 0.9 : 0.8,
    },
    ...["food-lifestyle", "technology"].map((category) => ({
      url: `${siteConfig.origin}/${locale}/creators/category/${category}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: locale === "id" ? 0.8 : 0.7,
    })),
  ]);
  return entries;
}
