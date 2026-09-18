import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsPanel } from "@/components/auth/settings-panel";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const translations = await getTranslations({ locale, namespace: "Auth" });
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
      </div>
    </main>
  );
}
