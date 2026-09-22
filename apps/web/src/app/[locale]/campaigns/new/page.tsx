import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getCreatorCatalog } from "@/lib/creator-server";
import { CampaignWizard } from "@/components/campaign/campaign-wizard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function NewCampaignPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/campaigns/new`);
  }

  const [catalog, t] = await Promise.all([
    getCreatorCatalog(locale),
    getTranslations({ locale, namespace: "Campaign" }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <Link
            href={`/${locale}/campaigns`}
            className="text-xs text-slate-400 hover:text-white transition-colors mb-1 inline-block"
          >
            ← {t("backToCampaigns")}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t("newCampaign")}</h1>
        </div>
      </div>

      <main id="main-content" className="campaigns-page">
        <CampaignWizard catalog={catalog} locale={locale} />
      </main>
    </div>
  );
}
