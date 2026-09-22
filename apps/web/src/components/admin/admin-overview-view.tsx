"use client";

import { useState } from "react";
import type { PlatformOverview } from "@/lib/admin-types";
import { getAdminOverview } from "@/lib/admin-client";
import Link from "next/link";
import {
  BadgeCheck,
  AlertTriangle,
  Landmark,
  TrendingUp,
  ShieldCheck,
  Percent,
  Users,
  ShoppingBag,
  Megaphone,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

interface AdminOverviewViewProps {
  initialData: PlatformOverview | null;
  locale: string;
  labels: {
    totalUsers: string;
    totalCreators: string;
    totalClients: string;
    totalOrders: string;
    totalCampaigns: string;
    totalGMV: string;
    escrowHeld: string;
    commissionEarned: string;
    pendingVerifications: string;
    activeDisputes: string;
    pendingPayouts: string;
    refresh: string;
    refreshing: string;
    error: string;
  };
}

function formatMinor(minor: number, currency: string, locale: string): string {
  const divisor = currency === "IDR" ? 1 : 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "MYR",
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(minor / divisor);
}

export function AdminOverviewView({
  initialData,
  locale,
  labels,
}: AdminOverviewViewProps) {
  const [data, setData] = useState<PlatformOverview | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const refreshed = await getAdminOverview();
      setData(refreshed);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : labels.error,
      );
    } finally {
      setLoading(false);
    }
  };

  if (!data && !loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0e1424]/40 p-12 text-center">
        <p className="text-sm text-rose-400 mb-4">{error || labels.error}</p>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <RefreshCw size={15} />
          {labels.refresh}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top bar with timestamp and refresh */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400 font-mono">
          {data?.timestamp
            ? new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(data.timestamp))
            : ""}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-blue-400" : ""} />
          {loading ? labels.refreshing : labels.refresh}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Actionable Alerts / Pending Queue */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href={`/${locale}/admin/creator-verifications`}
            className="group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] via-[#0e1424]/90 to-[#0e1424]/60 p-5 backdrop-blur-sm transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                {labels.pendingVerifications}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <BadgeCheck size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                {data?.pending_verifications ?? 0}
              </span>
              <span className="inline-flex items-center text-xs text-amber-400 group-hover:translate-x-0.5 transition-transform">
                Review <ArrowUpRight size={14} className="ml-0.5" />
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Awaiting identity review</p>
          </Link>

          <Link
            href={`/${locale}/admin/disputes`}
            className="group relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.08] via-[#0e1424]/90 to-[#0e1424]/60 p-5 backdrop-blur-sm transition-all hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400/90">
                {labels.activeDisputes}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                {data?.active_disputes ?? 0}
              </span>
              <span className="inline-flex items-center text-xs text-rose-400 group-hover:translate-x-0.5 transition-transform">
                Mediate <ArrowUpRight size={14} className="ml-0.5" />
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Open mediation cases</p>
          </Link>

          <Link
            href={`/${locale}/admin/finance`}
            className="group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.08] via-[#0e1424]/90 to-[#0e1424]/60 p-5 backdrop-blur-sm transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400/90">
                {labels.pendingPayouts}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Landmark size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                {data?.pending_payouts ?? 0}
              </span>
              <span className="inline-flex items-center text-xs text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Process <ArrowUpRight size={14} className="ml-0.5" />
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Payout queue requests</p>
          </Link>
        </div>
      </div>

      {/* Financial Health */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Platform Financials</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0e1424]/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">{labels.totalGMV}</span>
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {data ? formatMinor(data.total_gmv_minor, data.currency, locale) : "-"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0e1424]/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">{labels.escrowHeld}</span>
              <ShieldCheck size={16} className="text-blue-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {data ? formatMinor(data.escrow_held_minor, data.currency, locale) : "-"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0e1424]/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">{labels.commissionEarned}</span>
              <Percent size={16} className="text-purple-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {data ? formatMinor(data.commission_earned_minor, data.currency, locale) : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Activity & Counts */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Platform Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0e1424]/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">{labels.totalUsers}</span>
              <Users size={16} className="text-slate-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {data?.total_users ?? 0}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-slate-300">
                {data?.total_creators ?? 0} {labels.totalCreators.toLowerCase()}
              </span>
              <span>·</span>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-slate-300">
                {data?.total_clients ?? 0} {labels.totalClients.toLowerCase()}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0e1424]/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">{labels.totalOrders}</span>
              <ShoppingBag size={16} className="text-slate-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {data?.total_orders ?? 0}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0e1424]/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">{labels.totalCampaigns}</span>
              <Megaphone size={16} className="text-slate-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {data?.total_campaigns ?? 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
