"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Users,
  Calendar,
  Layers,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  X,
  ArrowRight,
} from "lucide-react";
import type { Campaign } from "@/lib/campaign-types";

type Labels = {
  newCampaign: string;
  emptyCampaigns: string;
  statusDraft: string;
  statusActive: string;
  statusCompleted: string;
  statusCancelled: string;
  budget: string;
  target: string;
  deadline: string;
  viewDetails: string;
  creatorsCount: string;
  filterAll: string;
  filterSearchPlaceholder: string;
  filterNoResults: string;
  filterReset: string;
  statsTotal: string;
  statsActive: string;
  statsDraft: string;
  statsCompleted: string;
};

interface ClientCampaignsViewProps {
  campaigns: Campaign[];
  locale: string;
  labels: Labels;
}

export function ClientCampaignsView({
  campaigns,
  locale,
  labels,
}: ClientCampaignsViewProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const formatBudget = (budgetMinor: number, currency: string) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(budgetMinor / (currency === "IDR" ? 1 : 100));
  };

  // Metrics
  const stats = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === "active").length;
    const draft = campaigns.filter((c) => c.status === "draft").length;
    const completed = campaigns.filter((c) => c.status === "completed").length;
    const cancelled = campaigns.filter((c) => c.status === "cancelled").length;

    return { total, active, draft, completed, cancelled };
  }, [campaigns]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((camp) => {
      // Status match
      if (selectedStatus !== "all" && camp.status !== selectedStatus) {
        return false;
      }

      // Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (camp.title || "").toLowerCase().includes(q);
        const descMatch = (camp.description || "").toLowerCase().includes(q);
        const idMatch = camp.id.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  }, [campaigns, selectedStatus, searchQuery]);

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0e1424]/50 py-16 sm:py-20 px-4 sm:px-6 text-center shadow-xs">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-5 border border-blue-500/20">
          <Megaphone size={32} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          {labels.emptyCampaigns}
        </h2>
        <div className="mt-8">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-md shadow-blue-500/20 active:scale-[0.98]"
            href={`/${locale}/campaigns/new`}
          >
            <Plus size={16} aria-hidden="true" />
            <span>{labels.newCampaign}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Campaigns */}
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

        {/* Active Campaigns */}
        <button
          type="button"
          onClick={() => setSelectedStatus("active")}
          className={`flex flex-col text-left p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "active"
              ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-[#0e1424]/80 border-slate-200/90 dark:border-white/10 hover:border-emerald-500/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              {labels.statsActive}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Clock3 size={15} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-300 tracking-tight tabular-nums">
            {stats.active}
          </p>
        </button>

        {/* Draft Campaigns */}
        <button
          type="button"
          onClick={() => setSelectedStatus("draft")}
          className={`flex flex-col text-left p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "draft"
              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-[#0e1424]/80 border-slate-200/90 dark:border-white/10 hover:border-amber-500/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 truncate">
              {labels.statsDraft}
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileText size={15} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-300 tracking-tight tabular-nums">
            {stats.draft}
          </p>
        </button>

        {/* Completed Campaigns */}
        <button
          type="button"
          onClick={() => setSelectedStatus("completed")}
          className={`flex flex-col text-left p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "completed"
              ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20"
              : "bg-white dark:bg-[#0e1424]/80 border-slate-200/90 dark:border-white/10 hover:border-blue-500/30 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">
              {labels.statsCompleted}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CheckCircle2 size={15} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-300 tracking-tight tabular-nums">
            {stats.completed}
          </p>
        </button>
      </div>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-1.5 sm:p-2 bg-white dark:bg-[#0e1424]/80 rounded-2xl border border-slate-200/90 dark:border-white/10 shadow-xs">
        {/* Filter Tabs */}
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
            onClick={() => setSelectedStatus("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              selectedStatus === "active"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            }`}
          >
            <span>{labels.statusActive}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "active"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {stats.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("draft")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              selectedStatus === "draft"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            }`}
          >
            <span>{labels.statusDraft}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "draft"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {stats.draft}
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
            <span>{labels.statusCompleted}</span>
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

          {stats.cancelled > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedStatus("cancelled")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedStatus === "cancelled"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <span>{labels.statusCancelled}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  selectedStatus === "cancelled"
                    ? "bg-blue-700 text-blue-100"
                    : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                }`}
              >
                {stats.cancelled}
              </span>
            </button>
          ) : null}
        </div>

        {/* Live Search */}
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

      {/* 3. Campaigns Grid or Filter Empty State */}
      {filteredCampaigns.length === 0 ? (
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
          {filteredCampaigns.map((camp) => {
            const targetCount = camp.target_creators;
            const deadlineVal = camp.deadline;

            return (
              <article
                key={camp.id}
                className="group flex flex-col justify-between h-full bg-white dark:bg-[#0e1424]/90 border border-slate-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 dark:hover:bg-[#131b2e] shadow-xs"
              >
                <div>
                  {/* Top Bar: Date & Status Badge */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5 flex-wrap">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(camp.created_at).toLocaleDateString(locale)}
                    </span>
                    <span
                      className={`campaign-card__badge campaign-card__badge--${camp.status}`}
                    >
                      {camp.status === "draft" && labels.statusDraft}
                      {camp.status === "active" && labels.statusActive}
                      {camp.status === "completed" && labels.statusCompleted}
                      {camp.status === "cancelled" && labels.statusCancelled}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3.5">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <Link href={`/${locale}/campaigns/${camp.id}`}>
                        {camp.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {camp.description}
                    </p>
                  </div>
                </div>

                {/* Meta details & Action link */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/10 space-y-3">
                  {/* Meta highlights */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {labels.budget}
                      </span>
                      <strong className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-0.5 block truncate">
                        {formatBudget(camp.budget_minor, camp.currency)}
                      </strong>
                    </div>

                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {labels.target}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5 truncate">
                        <Users size={13} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                        <span className="truncate">{labels.creatorsCount.replace("{count}", String(targetCount))}</span>
                      </span>
                    </div>
                  </div>

                  {/* Deadline if present */}
                  {deadlineVal ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar size={13} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
                      <span className="truncate">{labels.deadline}: {new Date(deadlineVal).toLocaleDateString(locale)}</span>
                    </div>
                  ) : null}

                  {/* Action Link Button */}
                  <div className="pt-1">
                    <Link
                      href={`/${locale}/campaigns/${camp.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white border border-slate-200/80 dark:border-white/10 hover:border-transparent px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent shadow-xs"
                    >
                      <span>{labels.viewDetails}</span>
                      <ArrowRight
                        size={14}
                        className="group-hover:translate-x-0.5 transition-transform"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
