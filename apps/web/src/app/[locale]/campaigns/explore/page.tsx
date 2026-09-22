import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getPublicCampaignsServer } from "@/lib/campaign-server";
import { getCurrentUser } from "@/lib/auth-server";
import { CampaignExploreView } from "@/components/campaign/campaign-explore-view";

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

  const [campaignsResult, currentUser] = await Promise.all([
    getPublicCampaignsServer({ limit: 50 }),
    getCurrentUser(),
  ]);

  const isCreator = Boolean(
    currentUser && currentUser.roles && currentUser.roles.includes("creator"),
  );
  const isLoggedIn = Boolean(currentUser);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CampaignExploreView
        initialCampaigns={campaignsResult.data}
        locale={locale}
        isCreator={isCreator}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
