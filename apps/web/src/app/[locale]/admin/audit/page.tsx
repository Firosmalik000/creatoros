import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAdminAuditLogsServer } from "@/lib/admin-server";
import { AdminAuditView } from "@/components/admin/admin-audit-view";

export const metadata: Metadata = {
  title: "Audit Trail — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const initialResponse = await listAdminAuditLogsServer({
    page: 1,
    per_page: 20,
  });

  return (
    <div className="admin-page">
      <AdminAuditView
        initialLogs={initialResponse?.data ?? []}
        initialTotal={initialResponse?.total ?? 0}
        locale={locale}
        labels={{
          title: t("audit.title"),
          empty: t("audit.empty"),
          time: t("audit.time"),
          actor: t("audit.actor"),
          action: t("audit.action"),
          resource: t("audit.resource"),
          details: t("audit.details"),
          ip: t("audit.ip"),
        }}
      />
    </div>
  );
}
