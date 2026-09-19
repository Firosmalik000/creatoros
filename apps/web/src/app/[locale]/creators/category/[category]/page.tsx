import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorDirectory } from "@/components/creator-directory";
import { SiteHeader } from "@/components/site-header";
import { getCreatorCatalog, getCreatorDirectory } from "@/lib/creator-server";
import type { AppLocale } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  const t = await getTranslations({ locale, namespace: "Creators" });
  const catalog = await getCreatorCatalog(locale);
  const categoryItem = catalog.categories.find(
    (item) => item.code === category,
  );
  const label = categoryItem?.name ?? category;
  return {
    title: `${label} creators | ${t("title")} | CreatorOS`,
    description: t("description"),
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/creators/category/${category}`,
      languages: {
        "id-ID": `${siteConfig.origin}/id/creators/category/${category}`,
        en: `${siteConfig.origin}/en/creators/category/${category}`,
        "ms-MY": `${siteConfig.origin}/ms/creators/category/${category}`,
        "x-default": `${siteConfig.origin}/id/creators/category/${category}`,
      },
    },
    robots: { index: Boolean(categoryItem), follow: true },
    openGraph: {
      title: `${label} creators | ${t("title")}`,
      description: t("description"),
      type: "website",
      url: `${siteConfig.origin}/${locale}/creators/category/${category}`,
    },
  };
}

export default async function CreatorCategoryPage({
  params,
}: {
  params: Promise<{ locale: AppLocale; category: string }>;
}) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const creators = await getTranslations("Creators");
  const nav = await getTranslations("Nav");
  const catalog = await getCreatorCatalog(locale);
  const categoryItem = catalog.categories.find(
    (item) => item.code === category,
  );
  if (!categoryItem) notFound();
  const query = new URLSearchParams({ category });
  const directory = await getCreatorDirectory(locale, query);
  return (
    <>
      <SiteHeader
        locale={locale}
        labels={{
          discover: nav("discover"),
          how: nav("how"),
          brands: nav("brands"),
          creators: nav("creators"),
          login: nav("login"),
          start: nav("start"),
          language: nav("language"),
        }}
      />
      <main className="directory shell" id="main-content">
        <Link className="back-link" href={`/${locale}/creators`}>
          <ArrowLeft aria-hidden="true" size={17} />
          {creators("back")}
        </Link>
        <div className="directory-heading">
          <p className="directory-kicker">{creators("kicker")}</p>
          <h1>{categoryItem.name}</h1>
          <p>{creators("description")}</p>
        </div>
        <CreatorDirectory
          fixedCategory={category}
          categories={catalog.categories}
          initial={directory}
        />
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${categoryItem.name} creators`,
            url: `${siteConfig.origin}/${locale}/creators/category/${category}`,
          }),
        }}
      />
    </>
  );
}
