import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsPanel } from "@/components/auth/settings-panel";
import { NotificationSettingsForm } from "@/components/communication/notification-settings-form";
import { getServerNotificationPreferences } from "@/lib/communication-server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const translations = await getTranslations({ locale, namespace: "Auth" });
  const notifTranslations = await getTranslations({
    locale,
    namespace: "NotificationSettings",
  });
  const initialPreferences = await getServerNotificationPreferences();

  return (
    <main className="settings-surface">
      <header className="settings-header shell">
        <Link className="wordmark" href={`/${locale}`}>
          Creator<span>OS</span>
        </Link>
        <Link className="auth-back" href={`/${locale}`}>
          {translations("backHome")}
        </Link>
      </header>
      <div className="settings-main shell">
        <header className="settings-heading">
          <h1>{translations("settingsTitle")}</h1>
          <p>{translations("settingsBody")}</p>
        </header>
        <SettingsPanel />
        <div className="settings-notification-card">
          <NotificationSettingsForm
            initialPreferences={initialPreferences}
            labels={{
              title: notifTranslations("title"),
              subtitle: notifTranslations("subtitle"),
              emailNotifications: notifTranslations("emailNotifications"),
              emailNotificationsDesc: notifTranslations("emailNotificationsDesc"),
              orderUpdates: notifTranslations("orderUpdates"),
              orderUpdatesDesc: notifTranslations("orderUpdatesDesc"),
              messages: notifTranslations("messages"),
              messagesDesc: notifTranslations("messagesDesc"),
              save: notifTranslations("save"),
              saving: notifTranslations("saving"),
              saved: notifTranslations("saved"),
              saveError: notifTranslations("saveError"),
            }}
          />
        </div>
      </div>
    </main>
  );
}
