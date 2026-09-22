import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

const SEEDED_CATEGORIES = [
  "food-lifestyle",
  "fashion-beauty",
  "tech-gadgets",
  "travel-hospitality",
  "education-finance",
  "gaming-entertainment",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [];

  // 1. Homepages with hreflang alternates
  for (const locale of routing.locales) {
    routes.push({
      url: `${siteConfig.origin}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: locale === "id" ? 1.0 : 0.9,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${siteConfig.origin}/${l}`]),
        ),
      },
    });
  }

  // 2. Creator Directory with hreflang alternates
  for (const locale of routing.locales) {
    routes.push({
      url: `${siteConfig.origin}/${locale}/creators`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: locale === "id" ? 0.9 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${siteConfig.origin}/${l}/creators`]),
        ),
      },
    });
  }

  // 3. Seeded Category Landing Pages with hreflang alternates
  for (const cat of SEEDED_CATEGORIES) {
    for (const locale of routing.locales) {
      routes.push({
        url: `${siteConfig.origin}/${locale}/creators/category/${cat}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: locale === "id" ? 0.8 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [
              l,
              `${siteConfig.origin}/${l}/creators/category/${cat}`,
            ]),
          ),
        },
      });
    }
  }

  return routes;
}
