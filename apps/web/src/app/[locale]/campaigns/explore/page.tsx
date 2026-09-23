import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getPublicCampaignsServer } from "@/lib/campaign-server";
import { getCurrentUser } from "@/lib/auth-server";
import { CampaignExploreView } from "@/components/campaign/campaign-explore-view";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter, type FooterLabels } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Eksplorasi Campaign Terbuka | CreatorOS",
  description:
    "Jelajahi campaign brand terverifikasi, ajukan proposal kolaborasi, dan dapatkan kontrak proyek konten kreator di Asia Tenggara.",
};

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function CampaignExplorePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [campaignsResult, currentUser, nav, footer] = await Promise.all([
    getPublicCampaignsServer({ limit: 50 }),
    getCurrentUser(),
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Footer" }),
  ]);

  const isCreator = Boolean(
    currentUser && currentUser.roles && currentUser.roles.includes("creator"),
  );
  const isLoggedIn = Boolean(currentUser);

  const navLabels = {
    discover: nav("discover"),
    how: nav("how"),
    brands: nav("brands"),
    creators: nav("creators"),
    login: nav("login"),
    start: nav("start"),
    language: nav("language"),
    dashboard: nav("dashboard"),
    logout: nav("logout"),
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
      <SiteHeader locale={locale} labels={navLabels} currentUser={currentUser} />
      <main id="main-content" className="min-h-screen bg-[#070a10]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CampaignExploreView
            initialCampaigns={campaignsResult.data}
            locale={locale}
            isCreator={isCreator}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </main>
      <SiteFooter locale={locale} labels={footerLabels} />
    </>
  );
}
