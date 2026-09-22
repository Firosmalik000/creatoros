import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
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
    title: `Creator Partner Agreement — ${siteConfig.name}`,
    description: "Operational standards, quality guarantees, and payout terms for verified creators on CreatorOS.",
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/legal/creator-agreement`,
    },
  };
}

export default async function CreatorAgreementPage({ params }: Props) {
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
              <Sparkles size={16} />
              <span>Talent & Agency Covenant</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              {tLegal("creatorAgreementTitle")}
            </h1>
            <p className="text-base text-white/60">
              {tLegal("creatorAgreementSubtitle")}
            </p>
            <p className="text-xs font-mono text-white/40 mt-4">
              {tLegal("creatorAgreementLastUpdated")}
            </p>
          </header>

          <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-white/80">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">1. Verification & Quality Standards</h2>
              <p>
                Creators accepted onto the CreatorOS roster agree to maintain genuine audience engagement metrics, deliver original content free from copyright infringement, and observe high professional standards in brand communications.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">2. Delivery Deadlines & Communication</h2>
              <p>
                Once an order is accepted, the creator is committed to delivering the initial cut within the stated package delivery turnaround window. In the event of unforeseen delay, the creator must notify the client and agency team before the deadline expires.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">3. Payout Schedule & Agency Commission</h2>
              <p>
                CreatorOS operates on a transparent commission structure (standard 15% platform management fee). The remaining 85% is deposited into the creator wallet immediately upon client approval of the final deliverable. Payout requests to local bank accounts are processed within 1-2 business days.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">4. Revision Execution</h2>
              <p>
                Creators agree to fulfill revision requests submitted by the client that fall within the package revision limit, provided the feedback adheres to the scope defined in the accepted initial order brief.
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter locale={typedLocale} labels={footerLabels} />
    </>
  );
}
