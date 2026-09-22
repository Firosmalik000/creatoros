"use client";

import { useState } from "react";
import type { AdminCampaign } from "@/lib/admin-types";
import { listAdminCampaigns } from "@/lib/admin-client";

interface AdminCampaignsViewProps {
  initialCampaigns: AdminCampaign[];
  initialTotal: number;
  locale: string;
  labels: {
    title: string;
    searchPlaceholder: string;
    campaign: string;
    client: string;
    budget: string;
    creators: string;
    status: string;
    empty: string;
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

export function AdminCampaignsView({
  initialCampaigns,
  initialTotal,
  locale,
  labels,
}: AdminCampaignsViewProps) {
  const [campaigns, setCampaigns] =
    useState<AdminCampaign[]>(initialCampaigns);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchCampaigns = async (
    s = search,
    st = statusFilter,
    p = page,
  ) => {
    setLoading(true);
    try {
      const res = await listAdminCampaigns({
        search: s || undefined,
        status: st || undefined,
        page: p,
        per_page: 20,
      });
      setCampaigns(res.data);
      setTotal(res.total);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCampaigns(search, statusFilter, 1);
  };

  const handleStatusChange = (st: string) => {
    setStatusFilter(st);
    setPage(1);
    fetchCampaigns(search, st, 1);
  };

  return (
    <div className="admin-campaigns">
      <div className="admin-toolbar">
        <form onSubmit={handleSearchSubmit} className="admin-search-form">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="admin-input"
          />
          <button type="submit" className="admin-btn admin-btn--secondary">
            Search
          </button>
        </form>

        <div className="admin-filters">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="admin-select"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="matching">Matching</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="admin-empty-state">
          <p>{labels.empty}</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{labels.campaign}</th>
                <th>{labels.client}</th>
                <th>{labels.budget}</th>
                <th>{labels.creators}</th>
                <th>{labels.status}</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.title}</strong>
                  </td>
                  <td>
                    <div className="admin-user-cell">
                      <span>{c.client_name}</span>
                      <small className="admin-user-email">{c.client_email}</small>
                    </div>
                  </td>
                  <td>
                    <strong>
                      {formatMinor(c.budget_minor, c.currency, locale)}
                    </strong>
                  </td>
                  <td>{c.target_creators} creators</td>
                  <td>
                    <span
                      className={`admin-badge admin-badge--campaign-${c.status}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(c.created_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="admin-pagination">
          <button
            onClick={() => {
              const newP = Math.max(1, page - 1);
              setPage(newP);
              fetchCampaigns(search, statusFilter, newP);
            }}
            disabled={page <= 1 || loading}
            className="admin-btn admin-btn--xs admin-btn--secondary"
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => {
              const newP = page + 1;
              setPage(newP);
              fetchCampaigns(search, statusFilter, newP);
            }}
            disabled={page * 20 >= total || loading}
            className="admin-btn admin-btn--xs admin-btn--secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
