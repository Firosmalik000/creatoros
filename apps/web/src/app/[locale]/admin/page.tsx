import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAdminOverviewServer } from "@/lib/admin-server";
import { AdminOverviewView } from "@/components/admin/admin-overview-view";

export const metadata: Metadata = {
  title: "Agency Dashboard — CreatorOS",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const overview = await getAdminOverviewServer();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("title")}</h1>
      </div>

      <AdminOverviewView
        initialData={overview}
        locale={locale}
        labels={{
          totalUsers: t("overview.totalUsers"),
          totalCreators: t("overview.totalCreators"),
          totalClients: t("overview.totalClients"),
          totalOrders: t("overview.totalOrders"),
          totalCampaigns: t("overview.totalCampaigns"),
          totalGMV: t("overview.totalGMV"),
          escrowHeld: t("overview.escrowHeld"),
          commissionEarned: t("overview.commissionEarned"),
          pendingVerifications: t("overview.pendingVerifications"),
          activeDisputes: t("overview.activeDisputes"),
          pendingPayouts: t("overview.pendingPayouts"),
          refresh: t("common.retry"),
          refreshing: t("common.loading"),
          error: t("common.error"),
        }}
      />
    </div>
  );
}
