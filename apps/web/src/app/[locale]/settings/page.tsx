import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UnifiedSettingsView } from "@/components/settings/unified-settings-view";
import { getCurrentUser } from "@/lib/auth-server";
import { getServerNotificationPreferences } from "@/lib/communication-server";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/settings`);
  }

  const [authT, navT, notifT, orderT, initialPreferences] = await Promise.all([
    getTranslations({ locale, namespace: "Auth" }),
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "NotificationSettings" }),
    getTranslations({ locale, namespace: "Order" }),
    getServerNotificationPreferences(),
  ]);

  const role = currentUser.roles.includes("admin")
    ? "admin"
    : currentUser.roles.includes("creator")
    ? "creator"
    : "client";

  const labels = {
    overview: "Overview",
    orders: role === "creator" ? "Active Orders" : orderT("workspaceNav.orders"),
    services: "My Services",
    campaigns: role === "creator" ? "Campaign Invites" : navT("campaigns"),
    wallet: "Wallet & Payouts",
    settings: authT("settingsTitle"),
    profileAndSocial: navT("profileAndSocial"),
    backToMarketplace: navT("discover"),
    exploreCampaigns: navT("exploreCampaigns"),
    language: navT("language"),
  };

  const notificationLabels = {
    title: notifT("title"),
    subtitle: notifT("subtitle"),
    emailNotifications: notifT("emailNotifications"),
    emailNotificationsDesc: notifT("emailNotificationsDesc"),
    orderUpdates: notifT("orderUpdates"),
    orderUpdatesDesc: notifT("orderUpdatesDesc"),
    messages: notifT("messages"),
    messagesDesc: notifT("messagesDesc"),
    save: notifT("save"),
    saving: notifT("saving"),
    saved: notifT("saved"),
    saveError: notifT("saveError"),
  };

  return (
    <DashboardShell
      locale={locale as AppLocale}
      role={role}
      user={{
        displayName: currentUser.display_name,
        email: currentUser.email,
        roles: currentUser.roles,
      }}
      labels={labels}
    >
      <Suspense fallback={<div className="p-8 text-white/50 text-sm">Memuat pengaturan...</div>}>
        <UnifiedSettingsView
          user={currentUser}
          initialNotificationPreferences={initialPreferences}
          notificationLabels={notificationLabels}
        />
      </Suspense>
    </DashboardShell>
  );
}
