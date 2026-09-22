import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAdminUsersServer } from "@/lib/admin-server";
import { AdminUsersView } from "@/components/admin/admin-users-view";

export const metadata: Metadata = {
  title: "User Directory — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const initialResponse = await listAdminUsersServer({ page: 1, per_page: 20 });

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1>{t("users.title")}</h1>
      </div>

      <AdminUsersView
        initialUsers={initialResponse?.data ?? []}
        initialTotal={initialResponse?.total ?? 0}
        locale={locale}
        labels={{
          title: t("users.title"),
          searchPlaceholder: t("users.searchPlaceholder"),
          allRoles: t("users.allRoles"),
          allStatuses: t("users.allStatuses"),
          active: t("users.active"),
          disabled: t("users.disabled"),
          pendingVerification: t("users.pendingVerification"),
          roles: t("users.roles"),
          status: t("users.status"),
          actions: t("users.actions"),
          disable: t("users.disable"),
          enable: t("users.enable"),
          editRoles: t("users.editRoles"),
          disableConfirm: t("users.disableConfirm"),
          reasonPlaceholder: t("users.reasonPlaceholder"),
          saveRoles: t("users.saveRoles"),
          statusUpdated: t("users.statusUpdated"),
          rolesUpdated: t("users.rolesUpdated"),
          empty: t("users.empty"),
        }}
      />
    </div>
  );
}
