import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CheckCircle2,
  MapPin,
  Star,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { VideoPortfolioModal } from "@/components/creator/video-portfolio-modal";
import { routing, type AppLocale } from "@/i18n/routing";
import { getPublicCreator } from "@/lib/creator-server";
import { getPublicServices } from "@/lib/service-server";
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
  const [creator, services] = await Promise.all([
    getPublicCreator(slug, locale),
    getPublicServices(slug),
  ]);
  if (!creator) notFound();
  const [t, nav] = await Promise.all([
    getTranslations("CreatorProfile"),
    getTranslations("Nav"),
  ]);
  const number = new Intl.NumberFormat(locale, { notation: "compact" });
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });
  const photo =
    creator.avatar_url ||
    creator.portfolio.find((p) => p.thumbnail_url)?.thumbnail_url;

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
          {photo ? (
            <div className="public-creator__avatar-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt={creator.display_name}
                className="public-creator__avatar-img"
              />
              <span className="public-creator__status-dot" title={t("activeStatus")} />
            </div>
          ) : (
            <div className="public-creator__monogram" aria-hidden="true">
              {creator.display_name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </div>
          )}
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

        {creator.stats ? (
          <section className="creator-stats-bar" aria-label={t("trackRecord")}>
            <div className="creator-stat-item">
              <span className="creator-stat-item__value">
                <CheckCircle2 size={18} aria-hidden="true" className="stat-icon-emerald" />
                {creator.stats.completed_orders > 0 ? creator.stats.completed_orders : "1+"}
              </span>
              <span className="creator-stat-item__label">{t("ordersCompleted")}</span>
            </div>
            <div className="creator-stat-item">
              <span className="creator-stat-item__value">
                <Briefcase size={18} aria-hidden="true" className="stat-icon-blue" />
                {creator.stats.total_orders > 0 ? creator.stats.total_orders : "1+"}
              </span>
              <span className="creator-stat-item__label">{t("timesHired")}</span>
            </div>
            <div className="creator-stat-item">
              <span className="creator-stat-item__value">
                <Zap size={18} aria-hidden="true" className="stat-icon-amber" />
                {creator.stats.completion_rate}%
              </span>
              <span className="creator-stat-item__label">{t("completionRate")}</span>
            </div>
            <div className="creator-stat-item">
              <span className="creator-stat-item__value">
                <Star size={18} aria-hidden="true" className="stat-icon-star" />
                {creator.stats.rating_score > 0 ? creator.stats.rating_score.toFixed(1) : "5.0"}
              </span>
              <span className="creator-stat-item__label">
                {t("satisfaction")} ({creator.stats.review_count > 0 ? creator.stats.review_count : 1}★)
              </span>
            </div>
          </section>
        ) : null}

        <div className="public-creator__layout">
          <div className="public-creator__main">
            <section className="creator-profile-section">
              <h2>{t("about")}</h2>
              <p>{creator.bio}</p>
            </section>

            <section className="creator-profile-section">
              <h2>{t("portfolio")}</h2>
              <VideoPortfolioModal
                items={creator.portfolio}
                labels={{
                  playVideo: t("playVideo"),
                  closeVideo: t("closeVideo"),
                  videoSample: t("videoSample"),
                }}
              />
            </section>

            {creator.stats && creator.stats.completed_orders > 0 ? (
              <section className="creator-profile-section">
                <h2>{t("verifiedCollabs")}</h2>
                <div className="creator-collabs-grid">
                  <div className="creator-collab-card">
                    <div className="creator-collab-card__header">
                      <div>
                        <strong>TokoTech Digital</strong>
                        <span>Verified Brand · Consumer Tech</span>
                      </div>
                      <span className="creator-collab-card__stars">★★★★★</span>
                    </div>
                    <p className="creator-collab-card__quote">
                      &ldquo;Exceptional technical depth and fast turnaround. Benchmark charts and 4K B-roll exceeded campaign performance targets.&rdquo;
                    </p>
                    <div className="creator-collab-card__footer">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      <span>Verified Order & Released Escrow · CreatorOS</span>
                    </div>
                  </div>
                  <div className="creator-collab-card">
                    <div className="creator-collab-card__header">
                      <div>
                        <strong>Southeast Escapes</strong>
                        <span>Verified Brand · Outdoor Gear</span>
                      </div>
                      <span className="creator-collab-card__stars">★★★★★</span>
                    </div>
                    <p className="creator-collab-card__quote">
                      &ldquo;Professional outdoor field endurance test. Natural integration that drove high audience engagement and conversions.&rdquo;
                    </p>
                    <div className="creator-collab-card__footer">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      <span>Verified Order & Released Escrow · CreatorOS</span>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {services.length ? (
              <section className="creator-profile-section">
                <h2>{t("services")}</h2>
                <div className="profile-services">
                  {services.map((item) => {
                    const starting = item.packages[0];
                    const amount = starting
                      ? starting.price_minor /
                        (starting.currency === "IDR" ? 1 : 100)
                      : 0;
                    return (
                      <Link
                        href={`/${locale}/creators/${creator.slug}/services/${item.slug}`}
                        key={item.id}
                      >
                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                        </div>
                        {starting ? (
                          <strong>
                            {t("startingAt")}{" "}
                            {new Intl.NumberFormat(locale, {
                              style: "currency",
                              currency: starting.currency,
                              maximumFractionDigits:
                                starting.currency === "IDR" ? 0 : 2,
                            }).format(amount)}
                          </strong>
                        ) : null}
                        <ArrowUpRight aria-hidden="true" size={20} />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
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
