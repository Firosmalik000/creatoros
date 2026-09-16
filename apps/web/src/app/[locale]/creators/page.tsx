import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorCard } from "@/components/creator-card";
import { SiteHeader } from "@/components/site-header";
import type { AppLocale } from "@/i18n/routing";
import { demoCreators, siteConfig } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Creators" });
  return {
    title: `${t("title")} | CreatorOS`,
    description: t("description"),
    alternates: { canonical: `${siteConfig.origin}/${locale}/creators` },
    robots: { index: false, follow: true },
  };
}

export default async function CreatorsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const creators = await getTranslations("Creators");
  const nav = await getTranslations("Nav");
  const common = await getTranslations("Common");

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
      <main id="main-content" className="directory shell">
        <Link className="back-link" href={`/${locale}`}>
          <ArrowLeft size={17} />
          {creators("back")}
        </Link>
        <div className="directory-heading">
          <h1>{creators("title")}</h1>
          <p>{creators("description")}</p>
        </div>
        <p className="demo-label">{common("illustrative")}</p>
        <div className="creator-grid">
          {demoCreators.map((creator) => (
            <CreatorCard
              creator={creator}
              engagementLabel={common("engagement")}
              followersLabel={common("followers")}
              key={creator.name}
              verifiedLabel={common("verified")}
            />
          ))}
        </div>
        <section className="directory-notice">
          <h2>{creators("emptyTitle")}</h2>
          <p>{creators("emptyBody")}</p>
        </section>
      </main>
    </>
  );
}
