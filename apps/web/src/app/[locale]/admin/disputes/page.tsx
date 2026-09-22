import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAdminDisputesServer } from "@/lib/admin-server";
import { AdminDisputesView } from "@/components/admin/admin-disputes-view";

export const metadata: Metadata = {
  title: "Dispute Center — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminDisputesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const initialResponse = await listAdminDisputesServer({
    page: 1,
    per_page: 20,
  });

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1>{t("disputes.title")}</h1>
      </div>

      <AdminDisputesView
        initialDisputes={initialResponse?.data ?? []}
        initialTotal={initialResponse?.total ?? 0}
        locale={locale}
        labels={{
          title: t("disputes.title"),
          empty: t("disputes.empty"),
          order: t("disputes.order"),
          reason: t("disputes.reason"),
          status: t("disputes.status"),
          resolutionNotes: t("disputes.resolutionNotes"),
          resolveTitle: t("disputes.resolveTitle"),
          refundClient: t("disputes.refundClient"),
          payCreator: t("disputes.payCreator"),
          dismiss: t("disputes.dismiss"),
          notesPlaceholder: t("disputes.notesPlaceholder"),
          submit: t("disputes.submit"),
          success: t("disputes.success"),
        }}
      />
    </div>
  );
}
