import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getCreatorCampaignInvitations } from "@/lib/campaign-server";
import { CreatorInvitesInbox } from "@/components/campaign/creator-invites-inbox";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function CreatorCampaignsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/creator/campaigns`);
  }

  const [invitations, t] = await Promise.all([
    getCreatorCampaignInvitations(),
    getTranslations({ locale, namespace: "Campaign" }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("creatorInboxTitle")}
        </h1>
      </div>

      <CreatorInvitesInbox invitations={invitations} locale={locale} />
    </div>
  );
}
