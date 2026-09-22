import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter, type FooterLabels } from "@/components/site-footer";
import { routing, type AppLocale } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: `Terms of Service — ${siteConfig.name}`,
    description: "Terms and conditions governing the use of the CreatorOS agency marketplace platform.",
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/legal/terms`,
    },
  };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const typedLocale = locale as AppLocale;
  setRequestLocale(locale);

  const tLegal = await getTranslations("Legal");
  const tNav = await getTranslations("Nav");
  const tFooter = await getTranslations("Footer");

  const navLabels = {
    discover: tNav("discover"),
    how: tNav("how"),
    brands: tNav("brands"),
    creators: tNav("creators"),
    login: tNav("login"),
    start: tNav("start"),
    language: tNav("language"),
  };

  const footerLabels: FooterLabels = {
    tagline: tFooter("tagline"),
    platform: tFooter("platform"),
    discoverCreators: tFooter("discoverCreators"),
    howItWorks: tFooter("howItWorks"),
    pricing: tFooter("pricing"),
    forBrands: tFooter("forBrands"),
    forCreators: tFooter("forCreators"),
    legal: tFooter("legal"),
    termsOfService: tFooter("termsOfService"),
    privacyPolicy: tFooter("privacyPolicy"),
    creatorAgreement: tFooter("creatorAgreement"),
    clientAgreement: tFooter("clientAgreement"),
    cookiePolicy: tFooter("cookiePolicy"),
    support: tFooter("support"),
    contactSupport: tFooter("contactSupport"),
    status: tFooter("status"),
    rightsReserved: tFooter("rightsReserved"),
  };

  return (
    <>
      <SiteHeader locale={typedLocale} labels={navLabels} />
      <main className="min-h-screen bg-[#0a0d12] text-white/90 pt-12 pb-24">
        <div className="shell max-w-4xl mx-auto px-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            {tLegal("backToHome")}
          </Link>

          <header className="border-b border-white/10 pb-8 mb-12">
            <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-[#60a5fa] mb-3">
              <Shield size={16} />
              <span>CreatorOS Legal Framework</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              {tLegal("termsTitle")}
            </h1>
            <p className="text-base text-white/60">
              {tLegal("termsSubtitle")}
            </p>
            <p className="text-xs font-mono text-white/40 mt-4">
              {tLegal("termsLastUpdated")}
            </p>
          </header>

          <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-white/80">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">1. Platform Scope & Operating Model</h2>
              <p>
                CreatorOS operates as a managed marketplace connecting commercial brand clients with verified content creators across Southeast Asia. By accessing or registering an account on CreatorOS, users agree to be bound by these Terms of Service, the Privacy Policy, and any supplemental operational agreements.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">2. Account Registration & Identity Verification</h2>
              <p>
                Users must register with accurate, verifiable contact details. Creator accounts undergo an agency verification audit prior to marketplace listing. The platform reserves the right to suspend or terminate accounts that provide misleading metrics, fraudulent identities, or violate platform community standards.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">3. Escrow Holdings & Financial Settlement</h2>
              <p>
                To protect both clients and creators, all orders require full prepayment held in secure platform escrow prior to production commencement. Escrowed funds are tracked via double-entry ledger invariants. Funds are released to the creator wallet upon client approval or agency dispute resolution.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">4. Content Deliverables & Revision Quotas</h2>
              <p>
                Creators agree to deliver content meeting the agreed brief specifications and delivery deadlines. Clients receive revision rights strictly within the purchased package quota. Revisions requesting substantive deviations from the original brief require a mutual agreement or new order.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">5. Agency Mediation & Dispute Governance</h2>
              <p>
                In the event of irreconcilable disputes between a client and a creator, either party may request agency mediation. An authorized CreatorOS administrator will examine the brief history, version deliverables, and communication records to issue a binding adjudication (refund, release, or structured split).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">6. Governing Law & Jurisdiction</h2>
              <p>
                These Terms of Service shall be governed by and construed under the applicable commercial laws of Southeast Asian operating jurisdictions where service is rendered.
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter locale={typedLocale} labels={footerLabels} />
    </>
  );
}
