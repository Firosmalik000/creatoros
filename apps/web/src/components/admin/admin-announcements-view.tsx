"use client";

import { useState } from "react";
import type { AdminAnnouncement } from "@/lib/admin-types";
import {
  listAdminAnnouncements,
  createAdminAnnouncement,
} from "@/lib/admin-client";

interface AdminAnnouncementsViewProps {
  initialAnnouncements: AdminAnnouncement[];
  locale: string;
  labels: {
    title: string;
    create: string;
    announcementTitle: string;
    body: string;
    targetRole: string;
    allUsers: string;
    creatorsOnly: string;
    clientsOnly: string;
    publish: string;
    published: string;
    empty: string;
  };
}

export function AdminAnnouncementsView({
  initialAnnouncements,
  locale,
  labels,
}: AdminAnnouncementsViewProps) {
  const [announcements, setAnnouncements] =
    useState<AdminAnnouncement[]>(initialAnnouncements);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchAnnouncements = async () => {
    try {
      const list = await listAdminAnnouncements();
      setAnnouncements(list);
    } catch {
      // Error handling
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await createAdminAnnouncement({
        title: title.trim(),
        body: body.trim(),
        target_role: targetRole,
      });
      setMessage({ type: "success", text: labels.published });
      setTitle("");
      setBody("");
      setIsCreateOpen(false);
      fetchAnnouncements();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to publish announcement.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-announcements">
      {message && (
        <div
          className={`admin-alert admin-alert--${message.type === "success" ? "success" : "error"}`}
        >
          {message.text}
        </div>
      )}

      <div className="admin-toolbar">
        <h2 className="admin-section-title">{labels.title}</h2>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="admin-btn admin-btn--primary"
        >
          {labels.create}
        </button>
      </div>

      {announcements.length === 0 ? (
        <div className="admin-empty-state">
          <p>{labels.empty}</p>
        </div>
      ) : (
        <div className="admin-announcement-list">
          {announcements.map((a) => (
            <div key={a.id} className="admin-card admin-announcement-card">
              <div className="admin-announcement-card__header">
                <h3>{a.title}</h3>
                <span className="admin-badge admin-badge--role">
                  {a.target_role === "all"
                    ? labels.allUsers
                    : a.target_role === "creator"
                      ? labels.creatorsOnly
                      : labels.clientsOnly}
                </span>
              </div>
              <p className="admin-announcement-card__body">{a.body}</p>
              <div className="admin-announcement-card__footer">
                <small>
                  Broadcast:{" "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(a.created_at))}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>{labels.create}</h3>
            <form onSubmit={handleCreate} className="admin-form">
              <div className="admin-form-group">
                <label htmlFor="ann-title">{labels.announcementTitle}:</label>
                <input
                  id="ann-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="ann-body">{labels.body}:</label>
                <textarea
                  id="ann-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="admin-textarea"
                  rows={4}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="ann-role">{labels.targetRole}:</label>
                <select
                  id="ann-role"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="admin-select"
                >
                  <option value="all">{labels.allUsers}</option>
                  <option value="creator">{labels.creatorsOnly}</option>
                  <option value="client">{labels.clientsOnly}</option>
                </select>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                  className="admin-btn admin-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn admin-btn--primary"
                >
                  {submitting ? "Publishing…" : labels.publish}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
