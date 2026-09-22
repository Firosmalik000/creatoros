import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAdminOrdersServer } from "@/lib/admin-server";
import { AdminOrdersView } from "@/components/admin/admin-orders-view";

export const metadata: Metadata = {
  title: "Orders Oversight — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const initialResponse = await listAdminOrdersServer({
    page: 1,
    per_page: 20,
  });

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1>{t("orders.title")}</h1>
      </div>

      <AdminOrdersView
        initialOrders={initialResponse?.data ?? []}
        initialTotal={initialResponse?.total ?? 0}
        locale={locale}
        labels={{
          title: t("orders.title"),
          searchPlaceholder: t("orders.searchPlaceholder"),
          client: t("orders.client"),
          creator: t("orders.creator"),
          service: t("orders.service"),
          price: t("orders.price"),
          status: t("orders.status"),
          dispute: t("orders.dispute"),
          empty: t("orders.empty"),
        }}
      />
    </div>
  );
}
