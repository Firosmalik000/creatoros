"use client";

import { useState } from "react";
import type { OrderDispute } from "@/lib/admin-types";
import { listAdminDisputes, resolveAdminDispute } from "@/lib/admin-client";

interface AdminDisputesViewProps {
  initialDisputes: OrderDispute[];
  initialTotal: number;
  locale: string;
  labels: {
    title: string;
    empty: string;
    order: string;
    reason: string;
    status: string;
    resolutionNotes: string;
    resolveTitle: string;
    refundClient: string;
    payCreator: string;
    dismiss: string;
    notesPlaceholder: string;
    submit: string;
    success: string;
  };
}

export function AdminDisputesView({
  initialDisputes,
  initialTotal,
  locale,
  labels,
}: AdminDisputesViewProps) {
  const [disputes, setDisputes] = useState<OrderDispute[]>(initialDisputes);
  const [total, setTotal] = useState(initialTotal);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Resolution modal
  const [resolvingDispute, setResolvingDispute] =
    useState<OrderDispute | null>(null);
  const [resolutionType, setResolutionType] = useState<
    "client_refund" | "creator_payout" | "dismiss"
  >("client_refund");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDisputes = async (st = statusFilter, p = page) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await listAdminDisputes({
        status: st || undefined,
        page: p,
        per_page: 20,
      });
      setDisputes(res.data);
      setTotal(res.total);
    } catch {
      setMessage({ type: "error", text: "Failed to load disputes." });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (st: string) => {
    setStatusFilter(st);
    setPage(1);
    fetchDisputes(st, 1);
  };

  const openResolveModal = (dispute: OrderDispute) => {
    setResolvingDispute(dispute);
    setResolutionType("client_refund");
    setResolutionNotes("");
  };

  const handleConfirmResolution = async () => {
    if (!resolvingDispute) return;
    if (!resolutionNotes.trim()) {
      setMessage({ type: "error", text: "Please enter resolution notes." });
      return;
    }
    setSubmitting(true);
    try {
      await resolveAdminDispute(
        resolvingDispute.order_id,
        resolutionType,
        resolutionNotes.trim(),
      );
      setMessage({ type: "success", text: labels.success });
      setResolvingDispute(null);
      fetchDisputes();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to resolve dispute.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-disputes">
      {message && (
        <div
          className={`admin-alert admin-alert--${message.type === "success" ? "success" : "error"}`}
        >
          {message.text}
        </div>
      )}

      <div className="admin-toolbar">
        <div className="admin-filters">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="admin-select"
          >
            <option value="">All Dispute Statuses</option>
            <option value="opened">Opened</option>
            <option value="under_review">Under Review</option>
            <option value="resolved_client_refund">
              Resolved (Client Refund)
            </option>
            <option value="resolved_creator_payout">
              Resolved (Creator Payout)
            </option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Loading disputes…</div>
      ) : disputes.length === 0 ? (
        <div className="admin-empty-state">
          <p>{labels.empty}</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{labels.order}</th>
                <th>Initiator</th>
                <th>{labels.reason}</th>
                <th>{labels.status}</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => {
                const isClosed =
                  d.status.startsWith("resolved_") || d.status === "dismissed";
                return (
                  <tr key={d.id}>
                    <td>
                      <code className="admin-code-id">{d.order_id}</code>
                    </td>
                    <td>
                      <code className="admin-code-id">
                        {d.initiator_user_id}
                      </code>
                    </td>
                    <td>
                      <p className="admin-dispute-reason">{d.reason}</p>
                      {d.resolution_notes && (
                        <small className="admin-resolution-note">
                          Note: {d.resolution_notes}
                        </small>
                      )}
                    </td>
                    <td>
                      <span
                        className={`admin-badge admin-badge--dispute-${d.status}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(new Date(d.created_at))}
                    </td>
                    <td>
                      {!isClosed ? (
                        <button
                          onClick={() => openResolveModal(d)}
                          className="admin-btn admin-btn--xs admin-btn--primary"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="admin-badge admin-badge--muted">
                          Settled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
              fetchDisputes(statusFilter, newP);
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
              fetchDisputes(statusFilter, newP);
            }}
            disabled={page * 20 >= total || loading}
            className="admin-btn admin-btn--xs admin-btn--secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingDispute && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>{labels.resolveTitle}</h3>
            <p>
              Order ID: <code>{resolvingDispute.order_id}</code>
            </p>
            <p className="admin-modal-subtext">
              Reason: <em>&ldquo;{resolvingDispute.reason}&rdquo;</em>
            </p>

            <div className="admin-form-group">
              <label>Decision / Adjudication:</label>
              <div className="admin-radio-group">
                <label className="admin-radio-label">
                  <input
                    type="radio"
                    name="resolution"
                    value="client_refund"
                    checked={resolutionType === "client_refund"}
                    onChange={() => setResolutionType("client_refund")}
                  />
                  <span>{labels.refundClient}</span>
                </label>
                <label className="admin-radio-label">
                  <input
                    type="radio"
                    name="resolution"
                    value="creator_payout"
                    checked={resolutionType === "creator_payout"}
                    onChange={() => setResolutionType("creator_payout")}
                  />
                  <span>{labels.payCreator}</span>
                </label>
                <label className="admin-radio-label">
                  <input
                    type="radio"
                    name="resolution"
                    value="dismiss"
                    checked={resolutionType === "dismiss"}
                    onChange={() => setResolutionType("dismiss")}
                  />
                  <span>{labels.dismiss}</span>
                </label>
              </div>
            </div>

            <div className="admin-form-group">
              <label htmlFor="notes-input">{labels.resolutionNotes}:</label>
              <textarea
                id="notes-input"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder={labels.notesPlaceholder}
                className="admin-textarea"
                rows={3}
                required
              />
            </div>

            <div className="admin-modal-actions">
              <button
                onClick={() => setResolvingDispute(null)}
                disabled={submitting}
                className="admin-btn admin-btn--secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolution}
                disabled={submitting || !resolutionNotes.trim()}
                className="admin-btn admin-btn--primary"
              >
                {submitting ? "Applying…" : labels.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
