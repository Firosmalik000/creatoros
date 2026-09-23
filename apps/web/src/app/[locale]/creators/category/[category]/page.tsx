import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorDirectory } from "@/components/creator-directory";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter, type FooterLabels } from "@/components/site-footer";
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
    robots: { index: true, follow: true },
    openGraph: {
      title: `${label} creators`,
      description: t("description"),
      type: "website",
      url: `${siteConfig.origin}/${locale}/creators/category/${category}`,
    },
  };
}

export default async function CategoryDirectoryPage({
  params,
}: {
  params: Promise<{ locale: AppLocale; category: string }>;
}) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const [creators, nav, footer, catalog] = await Promise.all([
    getTranslations("Creators"),
    getTranslations("Nav"),
    getTranslations("Footer"),
    getCreatorCatalog(locale),
  ]);
  const categoryItem = catalog.categories.find(
    (item) => item.code === category,
  );
  if (!categoryItem) notFound();
  const query = new URLSearchParams({ category });
  const directory = await getCreatorDirectory(locale, query);

  const footerLabels: FooterLabels = {
    tagline: footer("tagline"),
    platform: footer("platform"),
    discoverCreators: footer("discoverCreators"),
    campaigns: footer("campaigns"),
    howItWorks: footer("howItWorks"),
    pricing: footer("pricing"),
    forBrands: footer("forBrands"),
    forCreators: footer("forCreators"),
    legal: footer("legal"),
    termsOfService: footer("termsOfService"),
    privacyPolicy: footer("privacyPolicy"),
    creatorAgreement: footer("creatorAgreement"),
    clientAgreement: footer("clientAgreement"),
    cookiePolicy: footer("cookiePolicy"),
    support: footer("support"),
    contactSupport: footer("contactSupport"),
    status: footer("status"),
    rightsReserved: footer("rightsReserved"),
  };

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
          dashboard: nav("dashboard"),
          logout: nav("logout"),
        }}
      />
      <main className="directory shell" id="main-content">
        <Link className="back-link" href={`/${locale}/creators`}>
          <ArrowLeft aria-hidden="true" size={17} />
          {creators("back")}
        </Link>
        <div className="directory-heading">
          <h1>{categoryItem.name}</h1>
        </div>
        <CreatorDirectory
          fixedCategory={category}
          categories={catalog.categories}
          initial={directory}
        />
      </main>
      <SiteFooter locale={locale} labels={footerLabels} />
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
