import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderCard } from "@/components/order/order-card";
import type { AppLocale } from "@/i18n/routing";
import { getCreatorOrders } from "@/lib/order-server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function CreatorOrdersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/creator/orders`);
  }

  const orders = await getCreatorOrders();
  const t = await getTranslations({ locale, namespace: "Order" });

  const labels = {
    orderNumber: t("orderNumber"),
    package: t("package"),
    creator: t("creator"),
    client: t("client"),
    deadline: t("deadline"),
    deliveryDays: t.raw("deliveryDays") as string,
    viewDetail: t("viewDetail"),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {t("creatorTitle")}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {orders.length} active orders
          </p>
        </div>
      </div>

        {orders.length === 0 ? (
          <div className="orders-empty">
            <Inbox size={48} aria-hidden="true" />
            <h2>{t("creatorEmptyTitle")}</h2>
            <p>{t("creatorEmptyDescription")}</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                locale={locale}
                role="creator"
                labels={labels}
              />
            ))}
          </div>
        )}
    </div>
  );
}
