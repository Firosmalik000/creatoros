import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorOnboardingForm } from "@/components/creator/creator-onboarding-form";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CreatorOnboardingPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "CreatorOnboarding" });
  return (
    <main className="creator-workspace">
      <header className="creator-workspace__header shell">
        <Link className="wordmark" href={`/${locale}`}>
          Creator<span>OS</span>
        </Link>
        <Link className="auth-back" href={`/${locale}/settings`}>
          {t("accountLink")}
        </Link>
      </header>
      <div className="creator-workspace__intro shell">
        <h1>{t("title")}</h1>
        <p>{t("body")}</p>
      </div>
      <div className="shell">
        <CreatorOnboardingForm />
      </div>
    </main>
  );
}
