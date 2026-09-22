import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAdminAnnouncementsServer } from "@/lib/admin-server";
import { AdminAnnouncementsView } from "@/components/admin/admin-announcements-view";

export const metadata: Metadata = {
  title: "Announcements — CreatorOS Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAnnouncementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const initialAnnouncements = await listAdminAnnouncementsServer();

  return (
    <div className="admin-page">
      <AdminAnnouncementsView
        initialAnnouncements={initialAnnouncements}
        locale={locale}
        labels={{
          title: t("announcements.title"),
          create: t("announcements.create"),
          announcementTitle: t("announcements.announcementTitle"),
          body: t("announcements.body"),
          targetRole: t("announcements.targetRole"),
          allUsers: t("announcements.allUsers"),
          creatorsOnly: t("announcements.creatorsOnly"),
          clientsOnly: t("announcements.clientsOnly"),
          publish: t("announcements.publish"),
          published: t("announcements.published"),
          empty: t("announcements.empty"),
        }}
      />
    </div>
  );
}
