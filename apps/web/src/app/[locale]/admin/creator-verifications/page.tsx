import type { Metadata } from "next";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("title")}</h1>
      </div>
      <CreatorReviewPanel />
    </div>
  );
}
