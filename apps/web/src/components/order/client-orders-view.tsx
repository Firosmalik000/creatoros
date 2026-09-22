"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Sparkles,
  Layers,
} from "lucide-react";
import type { Order } from "@/lib/order-types";
import { OrderCard } from "./order-card";

type Labels = {
  orderNumber: string;
  package: string;
  creator: string;
  client: string;
  deadline: string;
  deliveryDays: string;
  viewDetail: string;
  exploreCreators: string;
  emptyTitle: string;
  emptyDescription: string;
  filterAll: string;
  filterSearchPlaceholder: string;
  filterNoResults: string;
  filterReset: string;
  statsTotal: string;
  statsInProgress: string;
  statsPending: string;
  statsCompleted: string;
  orderDate?: string;
  statuses: Record<string, string>;
};

interface ClientOrdersViewProps {
  orders: Order[];
  locale: string;
  labels: Labels;
}

export function ClientOrdersView({
  orders,
  locale,
  labels,
}: ClientOrdersViewProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Counts for each major bucket
  const stats = useMemo(() => {
    const total = orders.length;
    const inProgress = orders.filter((o) => o.status === "in_progress").length;
    const pending = orders.filter(
      (o) => o.status === "pending_acceptance",
    ).length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const others = orders.filter(
      (o) =>
        o.status !== "in_progress" &&
        o.status !== "pending_acceptance" &&
        o.status !== "completed",
    ).length;

    return { total, inProgress, pending, completed, others };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status match
      if (selectedStatus !== "all") {
        if (selectedStatus === "others") {
          const isMain =
            order.status === "in_progress" ||
            order.status === "pending_acceptance" ||
            order.status === "completed";
          if (isMain) return false;
        } else if (order.status !== selectedStatus) {
          return false;
        }
      }

      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = (order.service_title || "").toLowerCase().includes(query);
        const packageMatch = (order.package_name || "").toLowerCase().includes(query);
        const creatorMatch = (order.creator_display_name || "").toLowerCase().includes(query);
        const idMatch = order.id.toLowerCase().includes(query);
        if (!titleMatch && !packageMatch && !creatorMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, selectedStatus, searchQuery]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0e1424]/50 py-20 px-6 text-center shadow-lg">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 mb-5 border border-blue-500/20">
          <ShoppingBag size={32} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          {labels.emptyTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
          {labels.emptyDescription}
        </p>
        <Link
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
          href={`/${locale}/creators`}
        >
          <Sparkles size={16} aria-hidden="true" />
          {labels.exploreCreators}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Orders Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("all")}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "all"
              ? "bg-[#131b2e] border-blue-500/50 shadow-md shadow-blue-500/10"
              : "bg-[#0e1424]/80 border-white/10 hover:border-white/20 hover:bg-[#131b2e]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {labels.statsTotal}
            </span>
            <div className="p-1.5 rounded-lg bg-white/5 text-slate-300">
              <Layers size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums">
            {stats.total}
          </p>
        </button>

        {/* In Progress Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("in_progress")}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "in_progress"
              ? "bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-500/10"
              : "bg-[#0e1424]/80 border-white/10 hover:border-blue-500/30 hover:bg-[#131b2e]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">
              {labels.statsInProgress}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Clock3 size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold text-blue-300 tracking-tight tabular-nums">
            {stats.inProgress}
          </p>
        </button>

        {/* Pending Acceptance Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("pending_acceptance")}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "pending_acceptance"
              ? "bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10"
              : "bg-[#0e1424]/80 border-white/10 hover:border-amber-500/30 hover:bg-[#131b2e]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">
              {labels.statsPending}
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertCircle size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold text-amber-300 tracking-tight tabular-nums">
            {stats.pending}
          </p>
        </button>

        {/* Completed Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("completed")}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "completed"
              ? "bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-500/10"
              : "bg-[#0e1424]/80 border-white/10 hover:border-emerald-500/30 hover:bg-[#131b2e]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">
              {labels.statsCompleted}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold text-emerald-300 tracking-tight tabular-nums">
            {stats.completed}
          </p>
        </button>
      </div>

      {/* 2. Search and Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 bg-[#0e1424]/80 rounded-2xl border border-white/10">
        {/* Status Filter Tabs */}
        <div className="flex items-center overflow-x-auto gap-1 p-1">
          <button
            type="button"
            onClick={() => setSelectedStatus("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatus === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{labels.filterAll}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "all"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("in_progress")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatus === "in_progress"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{labels.statsInProgress}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "in_progress"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {stats.inProgress}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("pending_acceptance")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatus === "pending_acceptance"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{labels.statsPending}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "pending_acceptance"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {stats.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("completed")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatus === "completed"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{labels.statsCompleted}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "completed"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {stats.completed}
            </span>
          </button>

          {stats.others > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedStatus("others")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedStatus === "others"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>Lainnya</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  selectedStatus === "others"
                    ? "bg-blue-700 text-blue-100"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                {stats.others}
              </span>
            </button>
          ) : null}
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-72 px-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.filterSearchPlaceholder}
            className="w-full bg-[#070a10]/80 text-xs text-white placeholder:text-slate-500 border border-white/10 rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. Orders Grid or Filter Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0e1424]/40 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-slate-400 mb-4">
            <Search size={22} aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-white">
            {labels.filterNoResults}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus("all");
              setSearchQuery("");
            }}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors"
          >
            {labels.filterReset}
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              locale={locale}
              role="client"
              labels={labels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
