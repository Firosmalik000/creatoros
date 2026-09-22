import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });
  const navT = await getTranslations({ locale, namespace: "Nav" });

  const labels = {
    overview: "Overview",
    commerce: "Operations & Commerce",
    finance: "Financials & Ledger",
    management: "Talent & Users",
    system: "Platform Configuration",
    orders: t("nav.orders"),
    campaigns: t("nav.campaigns"),
    disputes: t("nav.disputes"),
    financeLabel: t("nav.finance"),
    users: t("nav.users"),
    verifications: t("nav.verifications"),
    categories: t("nav.categories"),
    announcements: t("nav.announcements"),
    audit: t("nav.audit"),
    settings: "Settings",
    backToMarketplace: "Marketplace",
    language: navT("language"),
  };

  return (
    <DashboardShell
      locale={locale as AppLocale}
      role="admin"
      user={{
        displayName: "Agency Administrator",
        email: "admin@creatoros.test",
        roles: ["admin"],
      }}
      labels={labels}
    >
      {children}
    </DashboardShell>
  );
}
