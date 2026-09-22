import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { NotificationsInbox } from "@/components/communication/notifications-inbox";
import type { AppLocale } from "@/i18n/routing";
import { getServerNotifications } from "@/lib/communication-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Notifications" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function NotificationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/notifications`);
  }

  const { notifications, total } = await getServerNotifications(false, 50, 0);

  const [t, nav] = await Promise.all([
    getTranslations({ locale, namespace: "Notifications" }),
    getTranslations({ locale, namespace: "Nav" }),
  ]);

  return (
    <>
      <SiteHeader
        locale={locale}
        labels={{
          discover: nav("discover"),
          how: nav("how"),
          brands: nav("brands"),
          creators: nav("creators"),
          login: nav("login"),
          start: nav("start"),
          language: nav("language"),
        }}
      />
      <main className="notifications-page" aria-label={t("title")}>
        <div className="shell page-container">
          <h1 className="page-title">{t("title")}</h1>
          <NotificationsInbox
            initialNotifications={notifications}
            initialTotal={total}
            locale={locale}
            labels={{
              title: t("title"),
              markAllRead: t("markAllRead"),
              unread: t("unread"),
              all: t("all"),
              empty: t("empty"),
              emptyUnread: t("emptyUnread"),
              kinds: {
                order_update: t("kinds.order_update"),
                submission_received: t("kinds.submission_received"),
                revision_requested: t("kinds.revision_requested"),
                submission_approved: t("kinds.submission_approved"),
                payment_received: t("kinds.payment_received"),
                escrow_released: t("kinds.escrow_released"),
                payout_update: t("kinds.payout_update"),
                campaign_invitation: t("kinds.campaign_invitation"),
                campaign_response: t("kinds.campaign_response"),
                new_message: t("kinds.new_message"),
                system: t("kinds.system"),
              },
            }}
          />
        </div>
      </main>
    </>
  );
}
