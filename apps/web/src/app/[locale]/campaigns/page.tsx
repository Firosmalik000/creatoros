import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientCampaignsView } from "@/components/campaign/client-campaigns-view";
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

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/campaigns`);
  }

  const campaigns = await getClientCampaigns();
  const t = await getTranslations({ locale, namespace: "Campaign" });

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
    <div className="space-y-8">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
            {t("clientKicker")}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t("campaignsList")}
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl leading-relaxed">
            {t("dashboardSubtitle")}
          </p>
        </div>

        <div className="flex items-center shrink-0">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-colors"
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
  );
}
