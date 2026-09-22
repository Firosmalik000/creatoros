"use client";

import { useState } from "react";
import type { AdminFinanceSummary } from "@/lib/admin-types";
import { getAdminFinanceOverview } from "@/lib/admin-client";

interface AdminFinanceViewProps {
  initialFinance: AdminFinanceSummary | null;
  locale: string;
  labels: {
    title: string;
    gmv: string;
    escrow: string;
    commissions: string;
    settled: string;
    pendingQueue: string;
    pendingSum: string;
    queueEmpty: string;
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

export function AdminFinanceView({
  initialFinance,
  locale,
  labels,
}: AdminFinanceViewProps) {
  const [finance, setFinance] = useState<AdminFinanceSummary | null>(
    initialFinance,
  );
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const refreshed = await getAdminFinanceOverview();
      setFinance(refreshed);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-finance">
      <div className="admin-overview__header">
        <h2 className="admin-section-title">{labels.title}</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="admin-btn admin-btn--secondary admin-btn--sm"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-card">
          <div className="admin-card__label">{labels.gmv}</div>
          <div className="admin-card__value">
            {finance
              ? formatMinor(finance.total_gmv_minor, finance.currency, locale)
              : "-"}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card__label">{labels.escrow}</div>
          <div className="admin-card__value">
            {finance
              ? formatMinor(
                  finance.total_escrow_minor,
                  finance.currency,
                  locale,
                )
              : "-"}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card__label">{labels.commissions}</div>
          <div className="admin-card__value">
            {finance
              ? formatMinor(
                  finance.total_commissions_minor,
                  finance.currency,
                  locale,
                )
              : "-"}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card__label">{labels.settled}</div>
          <div className="admin-card__value">
            {finance
              ? formatMinor(
                  finance.total_payouts_settled_minor,
                  finance.currency,
                  locale,
                )
              : "-"}
          </div>
        </div>
      </div>

      <div className="admin-finance__queue-card">
        <h3>{labels.pendingQueue}</h3>
        <div className="admin-queue-summary">
          <div>
            <span className="admin-queue-count">
              {finance?.pending_payouts_count ?? 0}
            </span>
            <span> requests awaiting review</span>
          </div>
          <div>
            <strong>{labels.pendingSum}: </strong>
            <span>
              {finance
                ? formatMinor(
                    finance.pending_payouts_sum_minor,
                    finance.currency,
                    locale,
                  )
                : "-"}
            </span>
          </div>
        </div>
        {(!finance || finance.pending_payouts_count === 0) && (
          <p className="admin-empty-text">{labels.queueEmpty}</p>
        )}
      </div>
    </div>
  );
}
