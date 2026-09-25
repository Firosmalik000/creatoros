import Link from "next/link";
import { ArrowRight, Clock3, Calendar } from "lucide-react";
import type { Order } from "@/lib/order-types";
import { OrderStatusBadge } from "./order-status-badge";

type Labels = {
  orderNumber: string;
  package: string;
  creator: string;
  client: string;
  deadline: string;
  deliveryDays: string;
  viewDetail: string;
  statuses: Record<string, string>;
  orderDate?: string;
};

type Props = {
  order: Order;
  locale: string;
  role: "client" | "creator";
  labels: Labels;
};

export function OrderCard({ order, locale, role, labels }: Props) {
  const formattedPrice = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: order.currency,
    maximumFractionDigits: order.currency === "IDR" ? 0 : 2,
  }).format(order.price_minor / (order.currency === "IDR" ? 1 : 100));

  const href =
    role === "creator"
      ? `/${locale}/creator/orders/${order.id}`
      : `/${locale}/orders/${order.id}`;

  const otherParty =
    role === "creator"
      ? order.client_display_name || labels.client
      : order.creator_display_name || labels.creator;

  const otherPartyRole = role === "creator" ? labels.client : labels.creator;
  const initial = otherParty ? otherParty.charAt(0).toUpperCase() : "O";

  const statusLabel = labels.statuses[order.status] ?? order.status;

  return (
    <article className="order-card group flex flex-col justify-between h-full bg-white dark:bg-[#0e1424]/90 border border-slate-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 dark:hover:bg-[#131b2e] shadow-xs">
      <div>
        {/* Top bar: Order ID & Status Badge */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5 flex-wrap">
          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2.5 py-0.5 rounded-md">
            #{order.id.slice(0, 8)}
          </span>
          <OrderStatusBadge status={order.status} label={statusLabel} />
        </div>

        {/* Title and Partner info */}
        <div className="mt-3.5">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {order.service_title || order.package_name}
          </h3>

          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{otherPartyRole}</p>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{otherParty}</p>
            </div>
          </div>
        </div>

        {/* Brief preview snippet if available */}
        {order.brief_content ? (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-black/20 p-2.5 rounded-xl border border-slate-100 dark:border-white/5 italic">
            &ldquo;{order.brief_content}&rdquo;
          </p>
        ) : null}
      </div>

      {/* Details: Price, delivery, deadline */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/10 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 truncate max-w-[140px]">
            {order.package_name}
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {formattedPrice}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
            <span>{labels.deliveryDays.replace("{count}", String(order.delivery_days))}</span>
          </span>

          {order.deadline_at ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
              <span className="truncate">{labels.deadline}: {new Date(order.deadline_at).toLocaleDateString(locale)}</span>
            </span>
          ) : null}
        </div>

        {/* Footer Link */}
        <div className="pt-1.5">
          <Link
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white border border-slate-200/80 dark:border-white/10 hover:border-transparent px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent shadow-xs"
            href={href}
          >
            <span>{labels.viewDetail}</span>
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
