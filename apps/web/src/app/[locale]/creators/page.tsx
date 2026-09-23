import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorDirectory } from "@/components/creator-directory";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter, type FooterLabels } from "@/components/site-footer";
import { getCreatorCatalog, getCreatorDirectory } from "@/lib/creator-server";
import type { AppLocale } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "Creators" });
  const hasFilters = Object.entries(query).some(
    ([key, value]) => key !== "locale" && Boolean(value),
  );
  return {
    title: `${t("title")} | CreatorOS`,
    description: t("description"),
    alternates: {
      canonical: `${siteConfig.origin}/${locale}/creators`,
      languages: {
        "id-ID": `${siteConfig.origin}/id/creators`,
        en: `${siteConfig.origin}/en/creators`,
        "ms-MY": `${siteConfig.origin}/ms/creators`,
        "x-default": `${siteConfig.origin}/id/creators`,
      },
    },
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      url: `${siteConfig.origin}/${locale}/creators`,
    },
  };
}

export default async function CreatorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const [creators, nav, footer] = await Promise.all([
    getTranslations("Creators"),
    getTranslations("Nav"),
    getTranslations("Footer"),
  ]);

  const initialParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === "string") initialParams.set(key, value);
  });
  const [directory, catalog] = await Promise.all([
    getCreatorDirectory(locale, initialParams),
    getCreatorCatalog(locale),
  ]);

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
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col">
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
          dashboard: nav("dashboard"),
          logout: nav("logout"),
        }}
      />

      <main className="flex-1 shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16" id="main-content">
        {/* Navigation Breadcrumb */}
        <Link
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-6 group px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 w-fit"
          href={`/${locale}`}
        >
          <ArrowLeft aria-hidden="true" size={14} className="group-hover:-translate-x-1 transition-transform" />
          <span>{creators("back")}</span>
        </Link>

        {/* Directory Hero Header */}
        <div className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e1628] via-[#090d18] to-[#070a10] border border-white/10 p-6 sm:p-10 shadow-2xl">
          {/* Subtle Ambient Decorative Glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-4">
              <Sparkles size={13} className="text-blue-400 animate-pulse" />
              <span>{creators("kicker")}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {creators("title")}
            </h1>

            <p className="mt-3 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl">
              {creators("description")}
            </p>

            {/* Platform Trust Highlights Row */}
            <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center gap-4 sm:gap-8 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span className="font-medium">100% Agency Quality Checked</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-400 shrink-0" />
                <span className="font-medium">Escrow Protection</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-purple-400 shrink-0" />
                <span className="font-medium">ID · MY · SG Coverage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Directory Catalog Workspace */}
        <CreatorDirectory categories={catalog.categories} initial={directory} />
      </main>

      <SiteFooter locale={locale} labels={footerLabels} />
    </div>
  );
}
