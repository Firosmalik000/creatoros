import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorReviewPanel } from "@/components/creator/creator-review-panel";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CreatorVerificationsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "CreatorReview" });
  return (
    <main className="creator-workspace creator-workspace--admin">
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
        <CreatorReviewPanel />
      </div>
    </main>
  );
}
