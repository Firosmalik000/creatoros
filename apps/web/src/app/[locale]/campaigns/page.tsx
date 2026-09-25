import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientCampaignsView } from "@/components/campaign/client-campaigns-view";
import { ClientCampaignShell } from "@/components/campaign/client-campaign-shell";
import type { AppLocale } from "@/i18n/routing";
import { getClientCampaigns } from "@/lib/campaign-server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function ClientCampaignsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [campaigns, t] = await Promise.all([
    getClientCampaigns(),
    getTranslations({ locale, namespace: "Campaign" }),
  ]);

  const labels = {
    newCampaign: t("newCampaign"),
    emptyCampaigns: t("emptyCampaigns"),
    statusDraft: t("statusDraft"),
    statusActive: t("statusActive"),
    statusCompleted: t("statusCompleted"),
    statusCancelled: t("statusCancelled"),
    budget: t("budget"),
    target: t("target"),
    deadline: t("deadline"),
    viewDetails: t("viewDetails"),
    creatorsCount: t.raw("creatorsCount") as string,
    filterAll: t("filterAll"),
    filterSearchPlaceholder: t("filterSearchPlaceholder"),
    filterNoResults: t("filterNoResults"),
    filterReset: t("filterReset"),
    statsTotal: t("statsTotal"),
    statsActive: t("statsActive"),
    statsDraft: t("statsDraft"),
    statsCompleted: t("statsCompleted"),
  };

  return (
    <ClientCampaignShell locale={locale}>
      <div className="space-y-6 sm:space-y-8">
        {/* Top Banner / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-5 sm:pb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
              {t("clientKicker")}
            </span>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t("campaignsList")}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {t("dashboardSubtitle")}
            </p>
          </div>

          <div className="flex items-center shrink-0 w-full sm:w-auto">
            <Link
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
              href={`/${locale}/campaigns/new`}
            >
              <Plus size={15} aria-hidden="true" />
              <span>{t("newCampaign")}</span>
            </Link>
          </div>
        </div>

        {/* Main Interactive Campaigns View */}
        <ClientCampaignsView
          campaigns={campaigns}
          locale={locale}
          labels={labels}
        />
      </div>
    </ClientCampaignShell>
  );
}
