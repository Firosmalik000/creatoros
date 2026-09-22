"use client";

import { useState } from "react";
import type { AdminAuditLog } from "@/lib/admin-types";
import { listAdminAuditLogs } from "@/lib/admin-client";

interface AdminAuditViewProps {
  initialLogs: AdminAuditLog[];
  initialTotal: number;
  locale: string;
  labels: {
    title: string;
    empty: string;
    time: string;
    actor: string;
    action: string;
    resource: string;
    details: string;
    ip: string;
  };
}

export function AdminAuditView({
  initialLogs,
  initialTotal,
  locale,
  labels,
}: AdminAuditViewProps) {
  const [logs, setLogs] = useState<AdminAuditLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (
    act = actionFilter,
    res = resourceFilter,
    p = page,
  ) => {
    setLoading(true);
    try {
      const result = await listAdminAuditLogs({
        action: act || undefined,
        resource_type: res || undefined,
        page: p,
        per_page: 20,
      });
      setLogs(result.data);
      setTotal(result.total);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const handleActionChange = (act: string) => {
    setActionFilter(act);
    setPage(1);
    fetchLogs(act, resourceFilter, 1);
  };

  const handleResourceChange = (res: string) => {
    setResourceFilter(res);
    setPage(1);
    fetchLogs(actionFilter, res, 1);
  };

  return (
    <div className="admin-audit">
      <div className="admin-toolbar">
        <h2 className="admin-section-title">{labels.title}</h2>
        <div className="admin-filters">
          <select
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
            className="admin-select"
          >
            <option value="">All Actions</option>
            <option value="user.status_update">user.status_update</option>
            <option value="user.roles_update">user.roles_update</option>
            <option value="dispute.resolved">dispute.resolved</option>
            <option value="category.create">category.create</option>
            <option value="category.update">category.update</option>
            <option value="announcement.create">announcement.create</option>
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => handleResourceChange(e.target.value)}
            className="admin-select"
          >
            <option value="">All Resource Types</option>
            <option value="user">user</option>
            <option value="order_dispute">order_dispute</option>
            <option value="category">category</option>
            <option value="announcement">announcement</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Loading audit records…</div>
      ) : logs.length === 0 ? (
        <div className="admin-empty-state">
          <p>{labels.empty}</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{labels.time}</th>
                <th>{labels.actor}</th>
                <th>{labels.action}</th>
                <th>{labels.resource}</th>
                <th>{labels.details}</th>
                <th>{labels.ip}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "short",
                      timeStyle: "medium",
                    }).format(new Date(log.created_at))}
                  </td>
                  <td>
                    <strong>{log.actor_email || "System"}</strong>
                  </td>
                  <td>
                    <span className="admin-badge admin-badge--action">
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span>{log.resource_type}: </span>
                    <code className="admin-code-id">{log.resource_id}</code>
                  </td>
                  <td>
                    <pre className="admin-details-snippet">
                      {JSON.stringify(log.details, null, 1)}
                    </pre>
                  </td>
                  <td>
                    <small>{log.ip_address || "—"}</small>
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
              fetchLogs(actionFilter, resourceFilter, newP);
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
              fetchLogs(actionFilter, resourceFilter, newP);
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
