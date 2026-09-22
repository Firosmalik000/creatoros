import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorCard } from "@/components/creator-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter, type FooterLabels } from "@/components/site-footer";
import { routing, type AppLocale } from "@/i18n/routing";
import { demoCreators, siteConfig } from "@/lib/site";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const home = await getTranslations("Home");
  const nav = await getTranslations("Nav");
  const common = await getTranslations("Common");
  const footer = await getTranslations("Footer");

  const navLabels = {
    discover: nav("discover"),
    campaigns: nav("campaigns"),
    how: nav("how"),
    brands: nav("brands"),
    creators: nav("creators"),
    login: nav("login"),
    start: nav("start"),
    language: nav("language"),
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: `${siteConfig.origin}/${locale}`,
    description: siteConfig.description,
  };

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
      <SiteHeader locale={locale} labels={navLabels} />
      <main id="main-content">
        <section className="hero shell">
          <div className="hero-copy">
            <h1>
              <span className="hero-title-serif">{home("heroTitleSerif")}</span>
              <span>{home("heroTitleSans")}</span>
            </h1>
            <p className="hero-body">{home("heroBody")}</p>
            <div className="hero-actions">
              <Link
                className="button button--signal"
                href={`/${locale}/creators`}
              >
                {home("primaryCta")}
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link className="button button--quiet" href={`/${locale}#join`}>
                {home("secondaryCta")}
              </Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="contact-sheet">
              <Image
                alt={home("heroVisualAlt")}
                className="contact-sheet__image"
                fill
                priority
                sizes="(max-width: 820px) calc(100vw - 28px), 54vw"
                src="/images/creator-contact-sheet-v2.png"
              />
            </div>
            <div className="hero-note">
              <ShieldCheck aria-hidden="true" size={18} />
              <span>{home("verified")}</span>
            </div>
          </div>
        </section>

        <section className="trust-band" aria-label={home("managed")}>
          <div className="shell trust-band__inner">
            <p>{home("managed")}</p>
            <ul>
              <li>
                <Check aria-hidden="true" size={16} />
                {home("verified")}
              </li>
              <li>
                <Sparkles aria-hidden="true" size={16} />
                {home("structured")}
              </li>
              <li>
                <WalletCards aria-hidden="true" size={16} />
                {home("payments")}
              </li>
            </ul>
          </div>
        </section>

        <section className="roster shell" id="creators">
          <div className="section-heading">
            <div>
              <h2>{home("rosterTitle")}</h2>
            </div>
            <Link className="arrow-link" href={`/${locale}/creators`}>
              {home("viewAll")}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
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
        </section>

        <section className="workflow" id="workflow">
          <div className="shell workflow-grid">
            <div className="workflow-intro">
              <h2>{home("workflowTitle")}</h2>
              <p>{home("workflowBody")}</p>
            </div>
            <ol className="workflow-list">
              {[
                [home("stepOne"), home("stepOneBody")],
                [home("stepTwo"), home("stepTwoBody")],
                [home("stepThree"), home("stepThreeBody")],
              ].map(([title, body], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="agency shell" id="agency">
          <div className="agency-stamp" aria-hidden="true">
            <ShieldCheck size={48} strokeWidth={1.5} />
            {home("managedStamp")}
          </div>
          <div className="agency-copy">
            <h2>{home("agencyTitle")}</h2>
            <p>{home("agencyBody")}</p>
            <Link className="arrow-link" href={`/${locale}#workflow`}>
              {home("agencyCta")}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </section>

        <section className="final-cta" id="join">
          <div className="shell final-cta__inner">
            <div>
              <h2>{home("finalTitle")}</h2>
              <p>{home("finalBody")}</p>
            </div>
            <Link className="button button--light" href={`/${locale}/creators`}>
              {home("primaryCta")}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} labels={footerLabels} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
