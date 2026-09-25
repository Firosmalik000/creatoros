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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0e1424]/50 py-16 sm:py-20 px-4 sm:px-6 text-center shadow-xs">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-5 border border-blue-500/20">
          <ShoppingBag size={32} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          {labels.emptyTitle}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
          {labels.emptyDescription}
        </p>
        <Link
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-md shadow-blue-500/20"
          href={`/${locale}/creators`}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span>{labels.exploreCreators}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Orders Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("all")}
          className={`flex flex-col text-left p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "all"
              ? "bg-blue-50/80 dark:bg-[#131b2e] border-blue-500/50 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20"
              : "bg-white dark:bg-[#0e1424]/80 border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              {labels.statsTotal}
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
              <Layers size={15} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {stats.total}
          </p>
        </button>

        {/* In Progress Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("in_progress")}
          className={`flex flex-col text-left p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "in_progress"
              ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20"
              : "bg-white dark:bg-[#0e1424]/80 border-slate-200/90 dark:border-white/10 hover:border-blue-500/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">
              {labels.statsInProgress}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock3 size={15} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-300 tracking-tight tabular-nums">
            {stats.inProgress}
          </p>
        </button>

        {/* Pending Acceptance Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("pending_acceptance")}
          className={`flex flex-col text-left p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "pending_acceptance"
              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-[#0e1424]/80 border-slate-200/90 dark:border-white/10 hover:border-amber-500/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 truncate">
              {labels.statsPending}
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle size={15} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-300 tracking-tight tabular-nums">
            {stats.pending}
          </p>
        </button>

        {/* Completed Card */}
        <button
          type="button"
          onClick={() => setSelectedStatus("completed")}
          className={`flex flex-col text-left p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "completed"
              ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-[#0e1424]/80 border-slate-200/90 dark:border-white/10 hover:border-emerald-500/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              {labels.statsCompleted}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={15} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-300 tracking-tight tabular-nums">
            {stats.completed}
          </p>
        </button>
      </div>

      {/* 2. Search and Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-1.5 sm:p-2 bg-white dark:bg-[#0e1424]/80 rounded-2xl border border-slate-200/90 dark:border-white/10 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center overflow-x-auto gap-1 p-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedStatus("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              selectedStatus === "all"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            }`}
          >
            <span>{labels.filterAll}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "all"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("in_progress")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              selectedStatus === "in_progress"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            }`}
          >
            <span>{labels.statsInProgress}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "in_progress"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {stats.inProgress}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("pending_acceptance")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              selectedStatus === "pending_acceptance"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            }`}
          >
            <span>{labels.statsPending}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "pending_acceptance"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {stats.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("completed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              selectedStatus === "completed"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            }`}
          >
            <span>{labels.statsCompleted}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "completed"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {stats.completed}
            </span>
          </button>

          {stats.others > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedStatus("others")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedStatus === "others"
                  ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <span>Lainnya</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  selectedStatus === "others"
                    ? "bg-blue-700 text-blue-100"
                    : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                }`}
              >
                {stats.others}
              </span>
            </button>
          ) : null}
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-64 px-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.filterSearchPlaceholder}
            className="w-full bg-slate-100 dark:bg-[#070a10]/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-white/10 rounded-xl pl-8.5 pr-8 py-2 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#070a10] transition-colors"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. Orders Grid or Filter Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0e1424]/40 py-14 px-6 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 mb-3">
            <Search size={20} aria-hidden="true" />
          </div>
          <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white">
            {labels.filterNoResults}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus("all");
              setSearchQuery("");
            }}
            className="mt-3.5 inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {labels.filterReset}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
