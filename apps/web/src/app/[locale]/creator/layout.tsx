import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface CreatorLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function CreatorLayout({
  children,
  params,
}: CreatorLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const navT = await getTranslations({ locale, namespace: "Nav" });

  const labels = {
    orders: "Active Orders",
    services: "My Services",
    campaigns: "Campaign Invites",
    wallet: "Wallet & Payouts",
    settings: "Settings",
    backToMarketplace: "Marketplace",
    exploreCampaigns: navT("exploreCampaigns"),
    language: navT("language"),
  };

  return (
    <DashboardShell
      locale={locale as AppLocale}
      role="creator"
      user={{
        displayName: "Creator Studio",
        email: "creator@creatoros.test",
        roles: ["creator"],
      }}
      labels={labels}
    >
      {children}
    </DashboardShell>
  );
}
