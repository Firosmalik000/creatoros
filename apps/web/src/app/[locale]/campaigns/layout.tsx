import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCurrentUser } from "@/lib/auth-server";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface ClientCampaignsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ClientCampaignsLayout({
  children,
  params,
}: ClientCampaignsLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [orderT, navT, currentUser] = await Promise.all([
    getTranslations({ locale, namespace: "Order" }),
    getTranslations({ locale, namespace: "Nav" }),
    getCurrentUser(),
  ]);

  const labels = {
    orders: orderT("workspaceNav.orders"),
    campaigns: navT("campaigns"),
    exploreCampaigns: navT("exploreCampaigns"),
    settings: orderT("workspaceNav.settings"),
    backToMarketplace: navT("discover"),
    language: navT("language"),
  };

  const user = currentUser
    ? {
        displayName: currentUser.display_name,
        email: currentUser.email,
        roles: currentUser.roles,
      }
    : null;

  let role: "client" | "creator" | "admin" = "client";
  if (currentUser?.roles?.includes("creator")) {
    role = "creator";
  } else if (currentUser?.roles?.includes("admin")) {
    role = "admin";
  }

  return (
    <DashboardShell
      locale={locale as AppLocale}
      role={role}
      user={user}
      labels={labels}
    >
      {children}
    </DashboardShell>
  );
}
