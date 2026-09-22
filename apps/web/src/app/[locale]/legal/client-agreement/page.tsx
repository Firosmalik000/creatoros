import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Briefcase } from "lucide-react";
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
    title: `Client Service Agreement — ${siteConfig.name}`,
    description: "Briefing standards, escrow obligations, and commercial IP transfer for brand clients.",
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/legal/client-agreement`,
    },
  };
}

export default async function ClientAgreementPage({ params }: Props) {
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
              <Briefcase size={16} />
              <span>Commercial Terms</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              {tLegal("clientAgreementTitle")}
            </h1>
            <p className="text-base text-white/60">
              {tLegal("clientAgreementSubtitle")}
            </p>
            <p className="text-xs font-mono text-white/40 mt-4">
              {tLegal("clientAgreementLastUpdated")}
            </p>
          </header>

          <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-white/80">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">1. Brief Specifications & Price Locking</h2>
              <p>
                When ordering creator services, the client must submit an actionable, clear creative brief. The package price, delivery window, and revision limit are immutably locked at checkout and recorded in the order snapshot.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">2. Escrow Prepayment</h2>
              <p>
                Client orders are only activated once total service fees are successfully charged and credited to platform escrow. This provides creators with full payment certainty while ensuring client funds are not released until deliverable satisfaction.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">3. Review Periods & Automatic Acceptance</h2>
              <p>
                Upon submission of deliverables by the creator, the client has 5 business days to review the content and either approve the submission or request a revision. If no action is taken within the review window, agency administrators may automatically verify deliverable compliance and authorize escrow release.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">4. Intellectual Property Rights & Licensing</h2>
              <p>
                Upon complete release of escrow funds to the creator, the client receives non-exclusive or exclusive commercial usage rights to the delivered media assets as designated in the package tier.
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter locale={typedLocale} labels={footerLabels} />
    </>
  );
}
