import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  getCampaignDetails,
  getCampaignMatchesServer,
} from "@/lib/campaign-server";
import { CampaignDetailView } from "@/components/campaign/campaign-detail-view";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale; campaignID: string }>;
};

export default async function CampaignDetailPage({ params }: PageProps) {
  const { locale, campaignID } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(
      `/${locale}/auth/login?redirect=/${locale}/campaigns/${campaignID}`,
    );
  }

  const [campaign, matches] = await Promise.all([
    getCampaignDetails(campaignID),
    getCampaignMatchesServer(campaignID),
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <main id="main-content" className="campaigns-page">
        <CampaignDetailView
          initialCampaign={campaign}
          initialMatches={matches}
          locale={locale}
        />
      </main>
    </div>
  );
}
