"use client";

import { useState } from "react";
import type { AdminUser } from "@/lib/admin-types";
import {
  listAdminUsers,
  updateAdminUserStatus,
  updateAdminUserRoles,
} from "@/lib/admin-client";

interface AdminUsersViewProps {
  initialUsers: AdminUser[];
  initialTotal: number;
  locale: string;
  labels: {
    title: string;
    searchPlaceholder: string;
    allRoles: string;
    allStatuses: string;
    active: string;
    disabled: string;
    pendingVerification: string;
    roles: string;
    status: string;
    actions: string;
    disable: string;
    enable: string;
    editRoles: string;
    disableConfirm: string;
    reasonPlaceholder: string;
    saveRoles: string;
    statusUpdated: string;
    rolesUpdated: string;
    empty: string;
  };
}

export function AdminUsersView({
  initialUsers,
  initialTotal,
  locale,
  labels,
}: AdminUsersViewProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Status modal
  const [statusModalUser, setStatusModalUser] = useState<AdminUser | null>(
    null,
  );
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Roles modal
  const [rolesModalUser, setRolesModalUser] = useState<AdminUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [rolesSubmitting, setRolesSubmitting] = useState(false);

  const fetchUsers = async (
    s = search,
    r = roleFilter,
    st = statusFilter,
    p = page,
  ) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await listAdminUsers({
        search: s || undefined,
        role: r || undefined,
        status: st || undefined,
        page: p,
        per_page: 20,
      });
      setUsers(res.data);
      setTotal(res.total);
    } catch {
      setMessage({ type: "error", text: "Failed to load users." });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search, roleFilter, statusFilter, 1);
  };

  const handleRoleFilterChange = (r: string) => {
    setRoleFilter(r);
    setPage(1);
    fetchUsers(search, r, statusFilter, 1);
  };

  const handleStatusFilterChange = (st: string) => {
    setStatusFilter(st);
    setPage(1);
    fetchUsers(search, roleFilter, st, 1);
  };

  // Status toggle handler
  const openStatusModal = (user: AdminUser) => {
    setStatusModalUser(user);
    setStatusReason("");
  };

  const handleConfirmStatus = async () => {
    if (!statusModalUser) return;
    const targetStatus =
      statusModalUser.status === "disabled" ? "active" : "disabled";
    setStatusSubmitting(true);
    try {
      await updateAdminUserStatus(
        statusModalUser.id,
        targetStatus,
        statusReason || "Administrative decision",
      );
      setMessage({ type: "success", text: labels.statusUpdated });
      setStatusModalUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update status.",
      });
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Roles update handler
  const openRolesModal = (user: AdminUser) => {
    setRolesModalUser(user);
    setSelectedRoles([...user.roles]);
  };

  const handleRoleToggle = (role: string) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length === 1) return; // Must have at least one role
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleConfirmRoles = async () => {
    if (!rolesModalUser) return;
    setRolesSubmitting(true);
    try {
      await updateAdminUserRoles(rolesModalUser.id, selectedRoles);
      setMessage({ type: "success", text: labels.rolesUpdated });
      setRolesModalUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update roles.",
      });
    } finally {
      setRolesSubmitting(false);
    }
  };

  const allAvailableRoles = ["client", "creator", "admin", "agency_admin"];

  return (
    <div className="admin-users">
      {message && (
        <div
          className={`admin-alert admin-alert--${message.type === "success" ? "success" : "error"}`}
        >
          {message.text}
        </div>
      )}

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
            value={roleFilter}
            onChange={(e) => handleRoleFilterChange(e.target.value)}
            className="admin-select"
          >
            <option value="">{labels.allRoles}</option>
            <option value="client">Client</option>
            <option value="creator">Creator</option>
            <option value="agency_admin">Agency Admin</option>
            <option value="admin">Platform Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="admin-select"
          >
            <option value="">{labels.allStatuses}</option>
            <option value="active">{labels.active}</option>
            <option value="disabled">{labels.disabled}</option>
            <option value="pending_verification">
              {labels.pendingVerification}
            </option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="admin-empty-state">
          <p>{labels.empty}</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>{labels.roles}</th>
                <th>{labels.status}</th>
                <th>Joined</th>
                <th>{labels.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="admin-user-cell">
                      <strong>{u.display_name}</strong>
                      <span className="admin-user-email">{u.email}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-badge-group">
                      {u.roles.map((r) => (
                        <span key={r} className="admin-badge admin-badge--role">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-badge admin-badge--status-${u.status}`}
                    >
                      {u.status === "active"
                        ? labels.active
                        : u.status === "disabled"
                          ? labels.disabled
                          : labels.pendingVerification}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(u.created_at))}
                  </td>
                  <td>
                    <div className="admin-table-actions">
                      <button
                        onClick={() => openRolesModal(u)}
                        className="admin-btn admin-btn--xs admin-btn--secondary"
                      >
                        {labels.editRoles}
                      </button>
                      <button
                        onClick={() => openStatusModal(u)}
                        className={`admin-btn admin-btn--xs ${
                          u.status === "disabled"
                            ? "admin-btn--success"
                            : "admin-btn--danger"
                        }`}
                      >
                        {u.status === "disabled"
                          ? labels.enable
                          : labels.disable}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {total > 20 && (
        <div className="admin-pagination">
          <button
            onClick={() => {
              const newP = Math.max(1, page - 1);
              setPage(newP);
              fetchUsers(search, roleFilter, statusFilter, newP);
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
              fetchUsers(search, roleFilter, statusFilter, newP);
            }}
            disabled={page * 20 >= total || loading}
            className="admin-btn admin-btn--xs admin-btn--secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Status Modal */}
      {statusModalUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>
              {statusModalUser.status === "disabled"
                ? labels.enable
                : labels.disable}{" "}
              User: {statusModalUser.display_name}
            </h3>
            <p>
              {statusModalUser.status === "disabled"
                ? "Re-enable this user account and restore platform access?"
                : labels.disableConfirm}
            </p>
            <div className="admin-form-group">
              <label htmlFor="reason-input">Reason:</label>
              <textarea
                id="reason-input"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder={labels.reasonPlaceholder}
                className="admin-textarea"
                rows={3}
              />
            </div>
            <div className="admin-modal-actions">
              <button
                onClick={() => setStatusModalUser(null)}
                disabled={statusSubmitting}
                className="admin-btn admin-btn--secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatus}
                disabled={statusSubmitting}
                className={`admin-btn ${
                  statusModalUser.status === "disabled"
                    ? "admin-btn--success"
                    : "admin-btn--danger"
                }`}
              >
                {statusSubmitting ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles Modal */}
      {rolesModalUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>
              {labels.editRoles}: {rolesModalUser.display_name}
            </h3>
            <div className="admin-checkbox-group">
              {allAvailableRoles.map((role) => (
                <label key={role} className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => handleRoleToggle(role)}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
            <div className="admin-modal-actions">
              <button
                onClick={() => setRolesModalUser(null)}
                disabled={rolesSubmitting}
                className="admin-btn admin-btn--secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRoles}
                disabled={rolesSubmitting || selectedRoles.length === 0}
                className="admin-btn admin-btn--primary"
              >
                {rolesSubmitting ? "Saving…" : labels.saveRoles}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
