import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, HelpCircle, Mail, MessageSquare, ShieldAlert } from "lucide-react";
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
    title: `Agency Support & Helpdesk — ${siteConfig.name}`,
    description: "Assistance with order issues, revision disputes, payment escrow, and creator onboarding.",
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/support`,
    },
  };
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  const typedLocale = locale as AppLocale;
  setRequestLocale(locale);

  const tSupport = await getTranslations("Support");
  const tNav = await getTranslations("Nav");
  const tFooter = await getTranslations("Footer");
  const tLegal = await getTranslations("Legal");

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

  const faqs = [
    { q: tSupport("faq1Q"), a: tSupport("faq1A") },
    { q: tSupport("faq2Q"), a: tSupport("faq2A") },
    { q: tSupport("faq3Q"), a: tSupport("faq3A") },
    { q: tSupport("faq4Q"), a: tSupport("faq4A") },
  ];

  return (
    <>
      <SiteHeader locale={typedLocale} labels={navLabels} />
      <main className="min-h-screen bg-[#0a0d12] text-white/90 pt-12 pb-24">
        <div className="shell max-w-5xl mx-auto px-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            {tLegal("backToHome")}
          </Link>

          <header className="border-b border-white/10 pb-8 mb-12">
            <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-[#60a5fa] mb-3">
              <HelpCircle size={16} />
              <span>CreatorOS Support Operations</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
              {tSupport("title")}
            </h1>
            <p className="text-base text-white/60 max-w-2xl">
              {tSupport("subtitle")}
            </p>
          </header>

          {/* Contact Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                  <Mail size={20} />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  {tSupport("emailLabel")}
                </h3>
                <p className="text-sm font-mono text-[#60a5fa]">
                  {tSupport("emailValue")}
                </p>
              </div>
              <p className="text-xs text-white/40 mt-4">
                {tSupport("responseTime")}
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                  <Clock size={20} />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  Operating Hours
                </h3>
                <p className="text-sm text-white/70">
                  {tSupport("hours")}
                </p>
              </div>
              <p className="text-xs text-white/40 mt-4">
                Jakarta · Kuala Lumpur · Singapore
              </p>
            </div>

            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  {tSupport("disputeTitle")}
                </h3>
                <p className="text-sm text-white/70">
                  {tSupport("disputeDesc")}
                </p>
              </div>
              <p className="text-xs text-white/40 mt-4">
                Binding agency arbitration within 24h
              </p>
            </div>
          </div>

          {/* FAQs Section */}
          <section>
            <div className="flex items-center gap-2 mb-8">
              <MessageSquare size={20} className="text-[#60a5fa]" />
              <h2 className="text-2xl font-bold text-white">
                {tSupport("faqTitle")}
              </h2>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-white/[0.03] border border-white/10 rounded-lg p-6"
                >
                  <h3 className="text-base font-semibold text-white mb-2">
                    {faq.q}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/70">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter locale={typedLocale} labels={footerLabels} />
    </>
  );
}
