import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cookie } from "lucide-react";
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
    title: `Cookie Policy — ${siteConfig.name}`,
    description: "Details regarding cookie usage, local storage, and privacy controls on CreatorOS.",
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/legal/cookies`,
    },
  };
}

export default async function CookiesPage({ params }: Props) {
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
              <Cookie size={16} />
              <span>Browser Storage & Transparency</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              {tLegal("cookiesTitle")}
            </h1>
            <p className="text-base text-white/60">
              {tLegal("cookiesSubtitle")}
            </p>
            <p className="text-xs font-mono text-white/40 mt-4">
              {tLegal("cookiesLastUpdated")}
            </p>
          </header>

          <article className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-white/80">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">1. What Are Cookies</h2>
              <p>
                Cookies and local storage tokens are small text records stored on your browser to maintain authentication sessions, remember chosen interface language preferences, and protect against Cross-Site Request Forgery (CSRF).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">2. Essential Cookies We Use</h2>
              <p>
                CreatorOS employs strictly necessary cookies:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-white/70">
                <li><strong className="text-white">auth_session</strong>: Encrypted session token to preserve login state across navigation.</li>
                <li><strong className="text-white">csrf_token</strong>: Double-submit verification token defending mutating POST/PUT requests against CSRF attacks.</li>
                <li><strong className="text-white">locale_pref</strong>: Language setting (id, en, ms) for localized content rendering.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">3. Third-Party Tracking & Advertising</h2>
              <p>
                We do not sell advertising cookies or employ invasive third-party cross-site behavioral tracking scripts. We only load essential analytics necessary to detect server performance anomalies and application errors.
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter locale={typedLocale} labels={footerLabels} />
    </>
  );
}
