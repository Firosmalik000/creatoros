import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAdminFinanceOverviewServer } from "@/lib/admin-server";
import { AdminFinanceView } from "@/components/admin/admin-finance-view";

export const metadata: Metadata = {
  title: "Finance Overview — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminFinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const finance = await getAdminFinanceOverviewServer();

  return (
    <div className="admin-page">
      <AdminFinanceView
        initialFinance={finance}
        locale={locale}
        labels={{
          title: t("finance.title"),
          gmv: t("finance.gmv"),
          escrow: t("finance.escrow"),
          commissions: t("finance.commissions"),
          settled: t("finance.settled"),
          pendingQueue: t("finance.pendingQueue"),
          pendingSum: t("finance.pendingSum"),
          queueEmpty: t("finance.queueEmpty"),
        }}
      />
    </div>
  );
}
