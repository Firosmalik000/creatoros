"use client";

import { useState } from "react";
import type { AdminOrder } from "@/lib/admin-types";
import { listAdminOrders } from "@/lib/admin-client";
import Link from "next/link";

interface AdminOrdersViewProps {
  initialOrders: AdminOrder[];
  initialTotal: number;
  locale: string;
  labels: {
    title: string;
    searchPlaceholder: string;
    client: string;
    creator: string;
    service: string;
    price: string;
    status: string;
    dispute: string;
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

export function AdminOrdersView({
  initialOrders,
  initialTotal,
  locale,
  labels,
}: AdminOrdersViewProps) {
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async (s = search, st = statusFilter, p = page) => {
    setLoading(true);
    try {
      const res = await listAdminOrders({
        search: s || undefined,
        status: st || undefined,
        page: p,
        per_page: 20,
      });
      setOrders(res.data);
      setTotal(res.total);
    } catch {
      // Error state
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders(search, statusFilter, 1);
  };

  const handleStatusChange = (st: string) => {
    setStatusFilter(st);
    setPage(1);
    fetchOrders(search, st, 1);
  };

  return (
    <div className="admin-orders">
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
            <option value="pending_acceptance">Pending Acceptance</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="admin-empty-state">
          <p>{labels.empty}</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order Details</th>
                <th>{labels.client}</th>
                <th>{labels.creator}</th>
                <th>{labels.price}</th>
                <th>{labels.status}</th>
                <th>Date</th>
                <th>{labels.dispute}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div className="admin-order-cell">
                      <strong>{order.service_name || "Custom Order"}</strong>
                      <span className="admin-order-pkg">
                        {order.package_name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-user-cell">
                      <span>{order.client_name}</span>
                      <small className="admin-user-email">
                        {order.client_email}
                      </small>
                    </div>
                  </td>
                  <td>
                    <span className="admin-creator-name">
                      {order.creator_name}
                    </span>
                  </td>
                  <td>
                    <strong>
                      {formatMinor(order.price_minor, order.currency, locale)}
                    </strong>
                  </td>
                  <td>
                    <span
                      className={`admin-badge admin-badge--order-${order.status}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(order.created_at))}
                  </td>
                  <td>
                    {order.has_dispute ? (
                      <Link
                        href={`/${locale}/admin/disputes`}
                        className="admin-badge admin-badge--danger"
                      >
                        {order.dispute_status || "Dispute"}
                      </Link>
                    ) : (
                      <span className="admin-badge admin-badge--muted">—</span>
                    )}
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
              fetchOrders(search, statusFilter, newP);
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
              fetchOrders(search, statusFilter, newP);
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
