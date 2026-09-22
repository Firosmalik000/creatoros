import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCurrentUser } from "@/lib/auth-server";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface ClientOrdersLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ClientOrdersLayout({
  children,
  params,
}: ClientOrdersLayoutProps) {
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
    : {
        displayName: "Brand Hub",
        email: "client@creatoros.test",
        roles: ["client"],
      };

  return (
    <DashboardShell
      locale={locale as AppLocale}
      role="client"
      user={user}
      labels={labels}
    >
      {children}
    </DashboardShell>
  );
}
