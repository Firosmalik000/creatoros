import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientOrdersView } from "@/components/order/client-orders-view";
import type { AppLocale } from "@/i18n/routing";
import { getClientOrders } from "@/lib/order-server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function ClientOrdersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/orders`);
  }

  const orders = await getClientOrders();
  const t = await getTranslations({ locale, namespace: "Order" });

  const labels = {
    orderNumber: t("orderNumber"),
    package: t("package"),
    creator: t("creator"),
    client: t("client"),
    deadline: t("deadline"),
    deliveryDays: t.raw("deliveryDays") as string,
    viewDetail: t("viewDetail"),
    exploreCreators: t("exploreCreators"),
    emptyTitle: t("emptyTitle"),
    emptyDescription: t("emptyDescription"),
    filterAll: t("filterAll"),
    filterSearchPlaceholder: t("filterSearchPlaceholder"),
    filterNoResults: t("filterNoResults"),
    filterReset: t("filterReset"),
    statsTotal: t("statsTotal"),
    statsInProgress: t("statsInProgress"),
    statsPending: t("statsPending"),
    statsCompleted: t("statsCompleted"),
    orderDate: t("orderDate"),
    statuses: {
      pending_acceptance: t("statuses.pending_acceptance"),
      accepted: t("statuses.accepted"),
      declined: t("statuses.declined"),
      in_progress: t("statuses.in_progress"),
      completed: t("statuses.completed"),
      cancelled: t("statuses.cancelled"),
      disputed: t("statuses.disputed"),
    },
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
            {t("clientTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl leading-relaxed">
            {t("clientDescription")}
          </p>
        </div>

        <div className="flex items-center shrink-0">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-colors"
            href={`/${locale}/creators`}
          >
            <Sparkles size={15} aria-hidden="true" />
            <span>{t("exploreCreators")}</span>
          </Link>
        </div>
      </div>

      {/* Main Interactive Orders View */}
      <ClientOrdersView orders={orders} locale={locale} labels={labels} />
    </div>
  );
}
