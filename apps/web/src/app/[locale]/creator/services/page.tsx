import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ServiceManager } from "@/components/service/service-manager";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CreatorServicesPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "CreatorServices" });
  return (
    <main className="creator-workspace service-workspace">
      <header className="creator-workspace__header shell">
        <Link className="wordmark" href={`/${locale}`}>
          Creator<span>OS</span>
        </Link>
        <nav className="workspace-links" aria-label={t("workspaceNav")}>
          <Link href={`/${locale}/creator/onboarding`}>{t("profileLink")}</Link>
          <Link href={`/${locale}/settings`}>{t("accountLink")}</Link>
        </nav>
      </header>
      <div className="creator-workspace__intro shell">
        <h1>{t("title")}</h1>
        <p>{t("body")}</p>
      </div>
      <div className="shell">
        <ServiceManager />
      </div>
    </main>
  );
}
