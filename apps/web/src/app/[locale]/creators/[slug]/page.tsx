import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  MapPin,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { routing, type AppLocale } from "@/i18n/routing";
import { getPublicCreator } from "@/lib/creator-server";
import { siteConfig } from "@/lib/site";

type PageProps = {
  params: Promise<{ locale: AppLocale; slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const [creator, t] = await Promise.all([
    getPublicCreator(slug, locale),
    getTranslations({ locale, namespace: "CreatorProfile" }),
  ]);
  if (!creator) return { title: t("notFoundTitle"), robots: { index: false } };
  const title = `${creator.display_name} — ${creator.headline} | CreatorOS`;
  const description = t("metadataDescription", {
    name: creator.display_name,
    headline: creator.headline,
    city: creator.city,
  });
  const languages = Object.fromEntries(
    routing.locales.map((language) => [
      language === "id" ? "id-ID" : language === "ms" ? "ms-MY" : "en",
      `${siteConfig.origin}/${language}/creators/${creator.slug}`,
    ]),
  );
  return {
    title,
    description,
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/creators/${creator.slug}`,
      languages: {
        ...languages,
        "x-default": `${siteConfig.origin}/id/creators/${creator.slug}`,
      },
    },
    openGraph: {
      type: "profile",
      title,
      description,
      url: `${siteConfig.origin}/${locale}/creators/${creator.slug}`,
      siteName: siteConfig.name,
    },
    robots: { index: true, follow: true },
  };
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const creator = await getPublicCreator(slug, locale);
  if (!creator) notFound();
  const [t, nav] = await Promise.all([
    getTranslations("CreatorProfile"),
    getTranslations("Nav"),
  ]);
  const number = new Intl.NumberFormat(locale, { notation: "compact" });
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: creator.display_name,
      description: creator.bio,
      url: `${siteConfig.origin}/${locale}/creators/${creator.slug}`,
      homeLocation: {
        "@type": "Place",
        name: `${creator.city}, ${creator.country_code}`,
      },
      sameAs: creator.social_accounts.map((account) => account.profile_url),
    },
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
      <main id="main-content" className="public-creator shell">
        <Link className="back-link" href={`/${locale}/creators`}>
          <ArrowLeft size={17} aria-hidden="true" />
          {t("back")}
        </Link>
        <header className="public-creator__hero">
          <div className="public-creator__monogram" aria-hidden="true">
            {creator.display_name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
          </div>
          <div className="public-creator__identity">
            <div className="verified-line">
              <BadgeCheck aria-hidden="true" fill="currentColor" size={19} />
              {t("verified")}
            </div>
            <h1>{creator.display_name}</h1>
            <p className="public-creator__headline">{creator.headline}</p>
            <p className="creator-location">
              <MapPin aria-hidden="true" size={16} />
              {creator.city}, {creator.country_code}
            </p>
          </div>
          <Link
            className="button button--signal"
            href={`/${locale}/auth/login`}
          >
            {t("hire")}
            <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
        </header>

        <div className="public-creator__layout">
          <div className="public-creator__main">
            <section className="creator-profile-section">
              <h2>{t("about")}</h2>
              <p>{creator.bio}</p>
            </section>
            <section className="creator-profile-section">
              <h2>{t("portfolio")}</h2>
              <div className="public-portfolio">
                {creator.portfolio.map((item, index) => (
                  <a
                    href={item.media_url}
                    key={item.id ?? `${item.title}-${index}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{item.title}</h3>
                      {item.description ? <p>{item.description}</p> : null}
                    </div>
                    <ArrowUpRight aria-hidden="true" size={20} />
                  </a>
                ))}
              </div>
            </section>
          </div>
          <aside className="creator-proof" aria-label={t("proofLabel")}>
            <h2>{t("platforms")}</h2>
            <div className="creator-proof__platforms">
              {creator.social_accounts.map((account) => (
                <a
                  href={account.profile_url}
                  key={account.platform_code}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div>
                    <strong>{account.platform_name}</strong>
                    <span>@{account.handle}</span>
                  </div>
                  <ArrowUpRight aria-hidden="true" size={17} />
                  <dl>
                    <div>
                      <dt>
                        <Users size={14} aria-hidden="true" /> {t("followers")}
                      </dt>
                      <dd>{number.format(account.follower_count)}</dd>
                    </div>
                    <div>
                      <dt>
                        <BarChart3 size={14} aria-hidden="true" />{" "}
                        {t("engagement")}
                      </dt>
                      <dd>{account.engagement_bps / 100}%</dd>
                    </div>
                  </dl>
                </a>
              ))}
            </div>
            <div className="creator-proof__facts">
              <div>
                <span>{t("categories")}</span>
                <p>{creator.categories.map((item) => item.name).join(" · ")}</p>
              </div>
              <div>
                <span>{t("languages")}</span>
                <p>
                  {creator.languages
                    .map((language) => languageNames.of(language) ?? language)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </aside>
        </div>
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
