import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getCreatorCatalog } from "@/lib/creator-server";
import { CampaignWizard } from "@/components/campaign/campaign-wizard";
import { ClientCampaignShell } from "@/components/campaign/client-campaign-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function NewCampaignPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [catalog, t] = await Promise.all([
    getCreatorCatalog(locale),
    getTranslations({ locale, namespace: "Campaign" }),
  ]);

  return (
    <ClientCampaignShell locale={locale}>
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
          <div>
            <Link
              href={`/${locale}/campaigns`}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-1 inline-block"
            >
              ← {t("backToCampaigns")}
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t("newCampaign")}</h1>
          </div>
        </div>

        <main id="main-content" className="campaigns-page">
          <CampaignWizard catalog={catalog} locale={locale} />
        </main>
      </div>
    </ClientCampaignShell>
  );
}
