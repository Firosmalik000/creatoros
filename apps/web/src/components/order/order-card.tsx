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
    <article className="order-card group flex flex-col justify-between h-full bg-[#0e1424]/90 border border-white/10 rounded-2xl p-6 transition-all duration-200 hover:border-blue-500/40 hover:bg-[#131b2e] hover:shadow-xl hover:shadow-blue-500/5">
      <div>
        {/* Top bar: Order ID & Status Badge */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
          <span className="font-mono text-xs font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
            #{order.id.slice(0, 8)}
          </span>
          <OrderStatusBadge status={order.status} label={statusLabel} />
        </div>

        {/* Title and Partner info */}
        <div className="mt-4">
          <h3 className="text-lg font-bold text-white tracking-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
            {order.service_title || order.package_name}
          </h3>

          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{otherPartyRole}</p>
              <p className="text-sm font-semibold text-slate-200 truncate">{otherParty}</p>
            </div>
          </div>
        </div>

        {/* Brief preview snippet if available */}
        {order.brief_content ? (
          <p className="mt-3 text-xs text-slate-400 line-clamp-2 bg-black/20 p-2 rounded-lg border border-white/5 italic">
            &ldquo;{order.brief_content}&rdquo;
          </p>
        ) : null}
      </div>

      {/* Details: Price, delivery, deadline */}
      <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
            {order.package_name}
          </span>
          <span className="text-lg font-bold text-white tracking-tight tabular-nums">
            {formattedPrice}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={14} className="text-slate-500" aria-hidden="true" />
            {labels.deliveryDays.replace("{count}", String(order.delivery_days))}
          </span>

          {order.deadline_at ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-500" aria-hidden="true" />
              <span>{labels.deadline}: {new Date(order.deadline_at).toLocaleDateString(locale)}</span>
            </span>
          ) : null}
        </div>

        {/* Footer Link */}
        <div className="pt-2">
          <Link
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-blue-600 hover:text-white border border-white/10 hover:border-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-all group-hover:bg-blue-600 group-hover:text-white shadow-sm"
            href={href}
          >
            <span>{labels.viewDetail}</span>
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
