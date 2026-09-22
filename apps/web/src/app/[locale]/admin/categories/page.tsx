import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAdminCategoriesServer } from "@/lib/admin-server";
import { AdminCategoriesView } from "@/components/admin/admin-categories-view";

export const metadata: Metadata = {
  title: "Categories — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const categories = await listAdminCategoriesServer();

  return (
    <div className="admin-page">
      <AdminCategoriesView
        initialCategories={categories}
        labels={{
          title: t("categories.title"),
          addCategory: t("categories.addCategory"),
          slug: t("categories.slug"),
          nameID: t("categories.nameID"),
          nameEN: t("categories.nameEN"),
          nameMS: t("categories.nameMS"),
          sortOrder: t("categories.sortOrder"),
          active: t("categories.active"),
          inactive: t("categories.inactive"),
          edit: t("categories.edit"),
          save: t("categories.save"),
          saved: t("categories.saved"),
        }}
      />
    </div>
  );
}
