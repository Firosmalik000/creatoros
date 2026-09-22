import { ArrowLeft, BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PackageSelector } from "@/components/service/package-selector";
import { SiteHeader } from "@/components/site-header";
import { routing, type AppLocale } from "@/i18n/routing";
import { getPublicService } from "@/lib/service-server";
import { siteConfig } from "@/lib/site";

type PageProps = {
  params: Promise<{ locale: AppLocale; slug: string; serviceSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug, serviceSlug } = await params;
  const item = await getPublicService(slug, serviceSlug);
  if (!item) return { robots: { index: false } };
  const title = `${item.title} — ${item.creator_display_name} | CreatorOS`;
  const description = item.description.slice(0, 155);
  const path = `creators/${item.creator_slug}/services/${item.slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/${path}`,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((language) => [
            language === "id" ? "id-ID" : language === "ms" ? "ms-MY" : "en",
            `${siteConfig.origin}/${language}/${path}`,
          ]),
        ),
        "x-default": `${siteConfig.origin}/id/${path}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteConfig.origin}/${locale}/${path}`,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicServicePage({ params }: PageProps) {
  const { locale, slug, serviceSlug } = await params;
  setRequestLocale(locale);
  const item = await getPublicService(slug, serviceSlug);
  if (!item) notFound();
  const [t, nav] = await Promise.all([
    getTranslations({ locale, namespace: "ServiceDetail" }),
    getTranslations({ locale, namespace: "Nav" }),
  ]);
  const offers = item.packages.map((pack) => ({
    "@type": "Offer",
    name: pack.name,
    priceCurrency: pack.currency,
    price: pack.price_minor / (pack.currency === "IDR" ? 1 : 100),
    availability: "https://schema.org/InStock",
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: item.title,
    description: item.description,
    provider: {
      "@type": "Person",
      name: item.creator_display_name,
      url: `${siteConfig.origin}/${locale}/creators/${item.creator_slug}`,
    },
    offers,
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
        }}
      />
      <main id="main-content" className="public-service shell">
        <Link
          className="back-link"
          href={`/${locale}/creators/${item.creator_slug}`}
        >
          <ArrowLeft aria-hidden="true" size={17} /> {t("back")}
        </Link>
        <header className="public-service__hero">
          <div>
            <div className="verified-line">
              <BadgeCheck aria-hidden="true" fill="currentColor" size={19} />
              {t("verified", { name: item.creator_display_name })}
            </div>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
          </div>
          <div className="public-service__count">
            <strong>{item.packages.length}</strong>
            <span>{t("packageCount", { count: item.packages.length })}</span>
          </div>
        </header>
        <PackageSelector
          labels={{
            choose: t("choose"),
            delivery: t("delivery"),
            deliveryValue: t.raw("deliveryValue") as string,
            revisions: t("revisions"),
            revisionValue: t.raw("revisionValue") as string,
            selected: t("selected"),
            continue: t("continue"),
          }}
          locale={locale}
          loginHref={`/${locale}/checkout/${item.creator_slug}/${item.slug}`}
          packages={item.packages}
        />
      </main>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
    </>
  );
}
