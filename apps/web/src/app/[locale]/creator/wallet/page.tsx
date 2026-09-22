import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatorWalletView } from "@/components/payment/creator-wallet-view";
import type { AppLocale } from "@/i18n/routing";
import {
  getCreatorWallet,
  getCreatorPayoutMethods,
  getCreatorPayouts,
} from "@/lib/payment-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Wallet" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function CreatorWalletPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/creator/wallet`);
  }

  const [walletDetail, methods, payouts] = await Promise.all([
    getCreatorWallet(),
    getCreatorPayoutMethods(),
    getCreatorPayouts(),
  ]);

  const t = await getTranslations({ locale, namespace: "Wallet" });

  // Redirect to login if wallet fetch failed (unauthenticated)
  if (!walletDetail) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/creator/wallet`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("title")}</h1>
      </div>
      <CreatorWalletView
        wallet={walletDetail.wallet}
        ledger={walletDetail.ledger}
        payoutMethods={methods}
        payouts={payouts}
        locale={locale}
        labels={{
          title: t("title"),
          available: t("available"),
          escrow: t("escrow"),
          totalWithdrawn: t("totalWithdrawn"),
          ledger: t("ledger"),
          noLedger: t("noLedger"),
          payoutMethods: t("payoutMethods"),
          addPayoutMethod: t("addPayoutMethod"),
          bankName: t("bankName"),
          accountNumber: t("accountNumber"),
          accountHolderName: t("accountHolderName"),
          payoutType: t("payoutType"),
          bankTransfer: t("bankTransfer"),
          eWallet: t("eWallet"),
          default: t("default"),
          addMethod: t("addMethod"),
          adding: t("adding"),
          methodAdded: t("methodAdded"),
          methodError: t("methodError"),
          requestPayout: t("requestPayout"),
          payoutAmount: t("payoutAmount"),
          payoutCurrency: t("payoutCurrency"),
          requestingPayout: t("requestingPayout"),
          payoutSuccess: t("payoutSuccess"),
          payoutError: t("payoutError"),
          minimumAmount: t("minimumAmount"),
          insufficientBalance: t("insufficientBalance"),
          payoutHistory: t("payoutHistory"),
          noPayouts: t("noPayouts"),
          payoutStatus: {
            pending: t("payoutStatus.pending"),
            processing: t("payoutStatus.processing"),
            completed: t("payoutStatus.completed"),
            rejected: t("payoutStatus.rejected"),
          },
        }}
      />
    </div>
  );
}
