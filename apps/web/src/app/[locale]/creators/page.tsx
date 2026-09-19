import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorDirectory } from "@/components/creator-directory";
import { SiteHeader } from "@/components/site-header";
import { getCreatorCatalog, getCreatorDirectory } from "@/lib/creator-server";
import type { AppLocale } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "Creators" });
  const hasFilters = Object.entries(query).some(
    ([key, value]) => key !== "locale" && Boolean(value),
  );
  return {
    title: `${t("title")} | CreatorOS`,
    description: t("description"),
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/creators`,
      languages: {
        "id-ID": `${siteConfig.origin}/id/creators`,
        en: `${siteConfig.origin}/en/creators`,
        "ms-MY": `${siteConfig.origin}/ms/creators`,
        "x-default": `${siteConfig.origin}/id/creators`,
      },
    },
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      url: `${siteConfig.origin}/${locale}/creators`,
    },
  };
}

export default async function CreatorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const creators = await getTranslations("Creators");
  const nav = await getTranslations("Nav");
  const initialParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === "string") initialParams.set(key, value);
  });
  const [directory, catalog] = await Promise.all([
    getCreatorDirectory(locale, initialParams),
    getCreatorCatalog(locale),
  ]);
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
        <Link className="back-link" href={`/${locale}`}>
          <ArrowLeft aria-hidden="true" size={17} />
          {creators("back")}
        </Link>
        <div className="directory-heading">
          <p className="directory-kicker">{creators("kicker")}</p>
          <h1>{creators("title")}</h1>
          <p>{creators("description")}</p>
        </div>
        <CreatorDirectory categories={catalog.categories} initial={directory} />
      </main>
    </>
  );
}
