import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
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
    title: `Privacy Policy — ${siteConfig.name}`,
    description: "How CreatorOS collects, handles, and safeguards personal and commercial data.",
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/legal/privacy`,
    },
  };
}

export default async function PrivacyPage({ params }: Props) {
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
              <Lock size={16} />
              <span>Data Protection & Privacy</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              {tLegal("privacyTitle")}
            </h1>
            <p className="text-base text-white/60">
              {tLegal("privacySubtitle")}
            </p>
            <p className="text-xs font-mono text-white/40 mt-4">
              {tLegal("privacyLastUpdated")}
            </p>
          </header>

          <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-white/80">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">1. Information We Collect</h2>
              <p>
                We collect personal information necessary to deliver marketplace, communication, and payment services. This includes account credentials, legal identification for KYC verification, public social media profile statistics, banking payout coordinates, and communication messages between buyers and creators.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">2. Purposes of Data Processing</h2>
              <p>
                Data is processed to facilitate creator discovery, campaign matchmaking, order execution, payment clearing, fraud prevention, regulatory compliance, and system security auditing. We never sell your personal contact or banking data to third-party advertisers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">3. Payment & Ledger Security</h2>
              <p>
                Payment card and bank transaction processing are executed via PCI-DSS compliant payment gateways (such as Midtrans and Stripe). Sensitive card tokens are never stored directly on CreatorOS infrastructure. Ledger entries are encrypted and strictly access-controlled.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">4. Cross-Border Data Transfers</h2>
              <p>
                Because CreatorOS operates regionally across Indonesia, Malaysia, and Singapore, data may be stored and processed in secured cloud regions equipped with ISO 27001 / SOC2 Type II certifications. Standard contractual clauses and encryption protect cross-border transmissions.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">5. User Privacy Rights</h2>
              <p>
                Users have the right to inspect, update, export, or request deletion of their account data subject to mandatory statutory tax and accounting retention requirements. Contact privacy@creatoros.agency to exercise these rights.
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter locale={typedLocale} labels={footerLabels} />
    </>
  );
}
