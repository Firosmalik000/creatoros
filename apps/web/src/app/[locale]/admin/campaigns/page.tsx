import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAdminCampaignsServer } from "@/lib/admin-server";
import { AdminCampaignsView } from "@/components/admin/admin-campaigns-view";

export const metadata: Metadata = {
  title: "Campaigns Oversight — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const initialResponse = await listAdminCampaignsServer({
    page: 1,
    per_page: 20,
  });

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1>{t("campaigns.title")}</h1>
      </div>

      <AdminCampaignsView
        initialCampaigns={initialResponse?.data ?? []}
        initialTotal={initialResponse?.total ?? 0}
        locale={locale}
        labels={{
          title: t("campaigns.title"),
          searchPlaceholder: t("campaigns.searchPlaceholder"),
          campaign: t("campaigns.campaign"),
          client: t("campaigns.client"),
          budget: t("campaigns.budget"),
          creators: t("campaigns.creators"),
          status: t("campaigns.status"),
          empty: t("campaigns.empty"),
        }}
      />
    </div>
  );
}
