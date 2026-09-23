import {
  ArrowRight,
  BadgeCheck,
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
import {
  FloatBadge,
  HeroItem,
  HeroMotion,
  InteractiveStep,
  ScrollReveal,
} from "@/components/home/motion-wrappers";

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
    dashboard: nav("dashboard"),
    logout: nav("logout"),
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
      <main id="main-content" className="landing-main">
        {/* Ambient Hero Aurora Lighting */}
        <div className="hero-aurora-glow hero-aurora-glow--1" aria-hidden="true" />
        <div className="hero-aurora-glow hero-aurora-glow--2" aria-hidden="true" />

        {/* Hero Section */}
        <section className="hero shell">
          <HeroMotion className="hero-grid">
            <div className="hero-copy">
              <HeroItem>
                <div className="hero-pill-badge">
                  <span className="hero-pill-badge__dot" />
                  <Sparkles size={14} className="hero-pill-badge__icon" />
                  <span>{home("managed")}</span>
                </div>
              </HeroItem>
              <HeroItem delay={0.08}>
                <h1 className="hero-headline">
                  <span className="hero-title-gradient">{home("heroTitleSerif")}</span>{" "}
                  <span className="hero-title-sans">{home("heroTitleSans")}</span>
                </h1>
              </HeroItem>
              <HeroItem delay={0.16}>
                <p className="hero-body">{home("heroBody")}</p>
              </HeroItem>
              <HeroItem delay={0.24}>
                <div className="hero-actions">
                  <Link
                    className="button button--signal hero-btn-primary"
                    href={`/${locale}/creators`}
                  >
                    <span>{home("primaryCta")}</span>
                    <ArrowRight aria-hidden="true" size={18} />
                  </Link>
                  <Link className="button button--quiet hero-btn-secondary" href={`/${locale}#join`}>
                    {home("secondaryCta")}
                  </Link>
                </div>
              </HeroItem>
            </div>

            <div className="hero-visual">
              <HeroItem delay={0.2}>
                <div className="contact-sheet-frame">
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
                  {/* Floating Badges with Physics Animation */}
                  <FloatBadge className="float-badge float-badge--verified" delay={0.3} yOffset={8}>
                    <ShieldCheck aria-hidden="true" size={18} />
                    <span>{home("verified")}</span>
                  </FloatBadge>
                  <FloatBadge className="float-badge float-badge--structured" delay={0.5} yOffset={10}>
                    <Sparkles aria-hidden="true" size={16} />
                    <span>{home("structured")}</span>
                  </FloatBadge>
                  <FloatBadge className="float-badge float-badge--payments" delay={0.7} yOffset={6}>
                    <WalletCards aria-hidden="true" size={16} />
                    <span>{home("payments")}</span>
                  </FloatBadge>
                </div>
              </HeroItem>
            </div>
          </HeroMotion>
        </section>

        {/* Trust Bar Section */}
        <section className="trust-section shell" aria-label={home("managed")}>
          <ScrollReveal direction="up">
            <div className="trust-bento-bar">
              <div className="trust-bento-bar__header">
                <BadgeCheck size={18} className="trust-icon--lead" />
                <span>{home("managed")}</span>
              </div>
              <div className="trust-bento-bar__divider" />
              <ul className="trust-bento-bar__items">
                <li className="trust-bento-item">
                  <div className="trust-bento-icon trust-bento-icon--verified">
                    <Check aria-hidden="true" size={16} />
                  </div>
                  <span>{home("verified")}</span>
                </li>
                <li className="trust-bento-item">
                  <div className="trust-bento-icon trust-bento-icon--structured">
                    <Sparkles aria-hidden="true" size={16} />
                  </div>
                  <span>{home("structured")}</span>
                </li>
                <li className="trust-bento-item">
                  <div className="trust-bento-icon trust-bento-icon--payments">
                    <WalletCards aria-hidden="true" size={16} />
                  </div>
                  <span>{home("payments")}</span>
                </li>
              </ul>
            </div>
          </ScrollReveal>
        </section>

        {/* Creator Roster Section */}
        <section className="roster shell" id="creators">
          <ScrollReveal direction="up">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">{home("managed")}</span>
                <h2>{home("rosterTitle")}</h2>
              </div>
              <Link className="arrow-link arrow-link--elevated" href={`/${locale}/creators`}>
                <span>{home("viewAll")}</span>
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </div>
          </ScrollReveal>
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

        {/* 3-Step Agency Workflow Section */}
        <section className="workflow" id="workflow">
          <div className="shell">
            <ScrollReveal direction="up" className="workflow-header-center">
              <span className="section-eyebrow">{home("structured")}</span>
              <h2>{home("workflowTitle")}</h2>
              <p>{home("workflowBody")}</p>
            </ScrollReveal>
            <div className="workflow-bento-cards">
              {[
                [home("stepOne"), home("stepOneBody")],
                [home("stepTwo"), home("stepTwoBody")],
                [home("stepThree"), home("stepThreeBody")],
              ].map(([title, body], index) => (
                <InteractiveStep
                  key={title}
                  stepNumber={index}
                  className="workflow-step-card"
                >
                  <div className="workflow-step-card__number">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="workflow-step-card__content">
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </InteractiveStep>
              ))}
            </div>
          </div>
        </section>

        {/* Agency Guarantee & Stamp Section */}
        <section className="agency shell" id="agency">
          <ScrollReveal direction="left">
            <div className="agency-stamp-card">
              <div className="agency-stamp-icon-box">
                <ShieldCheck size={52} strokeWidth={1.75} />
              </div>
              <span className="agency-stamp-text">{home("managedStamp")}</span>
            </div>
          </ScrollReveal>
          <ScrollReveal direction="right" className="agency-copy-card">
            <span className="section-eyebrow">{home("verified")}</span>
            <h2>{home("agencyTitle")}</h2>
            <p>{home("agencyBody")}</p>
            <Link className="arrow-link arrow-link--elevated" href={`/${locale}#workflow`}>
              <span>{home("agencyCta")}</span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </ScrollReveal>
        </section>

        {/* Final Conversion CTA Section */}
        <section className="final-cta shell" id="join">
          <ScrollReveal direction="up">
            <div className="final-cta__inner">
              <div className="final-cta__content">
                <span className="hero-pill-badge hero-pill-badge--light">
                  <Sparkles size={14} />
                  <span>CreatorOS Managed Agency</span>
                </span>
                <h2>{home("finalTitle")}</h2>
                <p>{home("finalBody")}</p>
              </div>
              <Link className="button button--light final-cta-btn" href={`/${locale}/creators`}>
                <span>{home("primaryCta")}</span>
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </div>
          </ScrollReveal>
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
