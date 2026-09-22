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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0e1424]/50 py-20 px-6 text-center shadow-lg">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 mb-5 border border-blue-500/20">
          <Megaphone size={32} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          {labels.emptyCampaigns}
        </h2>
        <div className="mt-8">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
            href={`/${locale}/campaigns/new`}
          >
            <Plus size={16} aria-hidden="true" />
            {labels.newCampaign}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Campaigns */}
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

        {/* Active Campaigns */}
        <button
          type="button"
          onClick={() => setSelectedStatus("active")}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "active"
              ? "bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-500/10"
              : "bg-[#0e1424]/80 border-white/10 hover:border-emerald-500/30 hover:bg-[#131b2e]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">
              {labels.statsActive}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Clock3 size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold text-emerald-300 tracking-tight tabular-nums">
            {stats.active}
          </p>
        </button>

        {/* Draft Campaigns */}
        <button
          type="button"
          onClick={() => setSelectedStatus("draft")}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "draft"
              ? "bg-slate-800/40 border-slate-400/40 shadow-md shadow-white/5"
              : "bg-[#0e1424]/80 border-white/10 hover:border-white/20 hover:bg-[#131b2e]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              {labels.statsDraft}
            </span>
            <div className="p-1.5 rounded-lg bg-white/5 text-slate-400">
              <FileText size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold text-slate-200 tracking-tight tabular-nums">
            {stats.draft}
          </p>
        </button>

        {/* Completed Campaigns */}
        <button
          type="button"
          onClick={() => setSelectedStatus("completed")}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
            selectedStatus === "completed"
              ? "bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-500/10"
              : "bg-[#0e1424]/80 border-white/10 hover:border-blue-500/30 hover:bg-[#131b2e]/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">
              {labels.statsCompleted}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <CheckCircle2 size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold text-blue-300 tracking-tight tabular-nums">
            {stats.completed}
          </p>
        </button>
      </div>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 bg-[#0e1424]/80 rounded-2xl border border-white/10">
        {/* Filter Tabs */}
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
            onClick={() => setSelectedStatus("active")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatus === "active"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{labels.statusActive}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "active"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {stats.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus("draft")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatus === "draft"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{labels.statusDraft}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedStatus === "draft"
                  ? "bg-blue-700 text-blue-100"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {stats.draft}
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
            <span>{labels.statusCompleted}</span>
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

          {stats.cancelled > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedStatus("cancelled")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedStatus === "cancelled"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{labels.statusCancelled}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  selectedStatus === "cancelled"
                    ? "bg-blue-700 text-blue-100"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                {stats.cancelled}
              </span>
            </button>
          ) : null}
        </div>

        {/* Live Search */}
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

      {/* 3. Campaigns Grid or Filter Empty State */}
      {filteredCampaigns.length === 0 ? (
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
          {filteredCampaigns.map((camp) => {
            const targetCount = camp.target_creators;
            const deadlineVal = camp.deadline;

            return (
              <article
                key={camp.id}
                className="group flex flex-col justify-between h-full bg-[#0e1424]/90 border border-white/10 rounded-2xl p-6 transition-all duration-200 hover:border-blue-500/40 hover:bg-[#131b2e] hover:shadow-xl hover:shadow-blue-500/5"
              >
                <div>
                  {/* Top Bar: Date & Status Badge */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <span className="text-xs text-slate-400 font-mono">
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
                  <div className="mt-4">
                    <h3 className="text-lg font-bold text-white tracking-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
                      <Link href={`/${locale}/campaigns/${camp.id}`}>
                        {camp.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed">
                      {camp.description}
                    </p>
                  </div>
                </div>

                {/* Meta details & Action link */}
                <div className="mt-6 pt-4 border-t border-white/10 space-y-4">
                  {/* Meta highlights */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {labels.budget}
                      </span>
                      <strong className="text-sm font-bold text-white tracking-tight tabular-nums mt-0.5 block">
                        {formatBudget(camp.budget_minor, camp.currency)}
                      </strong>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {labels.target}
                      </span>
                      <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                        <Users size={14} className="text-slate-400" aria-hidden="true" />
                        {labels.creatorsCount.replace("{count}", String(targetCount))}
                      </span>
                    </div>
                  </div>

                  {/* Deadline if present */}
                  {deadlineVal ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar size={13} className="text-slate-500" aria-hidden="true" />
                      <span>{labels.deadline}: {new Date(deadlineVal).toLocaleDateString(locale)}</span>
                    </div>
                  ) : null}

                  {/* Action Link Button */}
                  <div>
                    <Link
                      href={`/${locale}/campaigns/${camp.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-blue-600 hover:text-white border border-white/10 hover:border-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-all group-hover:bg-blue-600 group-hover:text-white shadow-sm"
                    >
                      <span>{labels.viewDetails}</span>
                      <ArrowRight
                        size={15}
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
