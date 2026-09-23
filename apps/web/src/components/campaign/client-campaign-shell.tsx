import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCurrentUser } from "@/lib/auth-server";
import type { AppLocale } from "@/i18n/routing";

export async function ClientCampaignShell({
  locale,
  children,
}: {
  locale: AppLocale;
  children: React.ReactNode;
}) {
  setRequestLocale(locale);

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/campaigns`);
  }

  const isClient = currentUser.roles?.includes("client");
  const isAdmin = currentUser.roles?.includes("admin");

  if (!isClient && !isAdmin) {
    if (currentUser.roles?.includes("creator")) {
      redirect(`/${locale}/creator/campaigns`);
    }
    redirect(`/${locale}/orders`);
  }

  const [orderT, navT] = await Promise.all([
    getTranslations({ locale, namespace: "Order" }),
    getTranslations({ locale, namespace: "Nav" }),
  ]);

  const labels = {
    orders: orderT("workspaceNav.orders"),
    campaigns: navT("campaigns"),
    exploreCampaigns: navT("exploreCampaigns"),
    settings: orderT("workspaceNav.settings"),
    backToMarketplace: navT("discover"),
    language: navT("language"),
  };

  const user = {
    displayName: currentUser.display_name,
    email: currentUser.email,
    roles: currentUser.roles,
  };

  const role: "client" | "admin" = isAdmin ? "admin" : "client";

  return (
    <DashboardShell
      locale={locale}
      role={role}
      user={user}
      labels={labels}
    >
      {children}
    </DashboardShell>
  );
}
