"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, ExternalLink, Bell } from "lucide-react";
import type { Notification } from "@/lib/communication-types";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/communication-client";

type Props = {
  initialNotifications: Notification[];
  initialTotal: number;
  locale: string;
  labels: {
    title: string;
    markAllRead: string;
    unread: string;
    all: string;
    empty: string;
    emptyUnread: string;
    kinds: Record<string, string>;
  };
};

export function NotificationsInbox({
  initialNotifications,
  initialTotal,
  locale,
  labels,
}: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications,
  );
  const [total, setTotal] = useState<number>(initialTotal);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);

  async function handleFilterChange(newFilter: "all" | "unread") {
    setFilter(newFilter);
    setLoading(true);
    try {
      const res = await listNotifications(newFilter === "unread", 50, 0);
      setNotifications(res.notifications);
      setTotal(res.total);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="notifications-inbox">
      <div className="notifications-inbox__toolbar">
        <div className="notifications-inbox__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`tab-btn ${filter === "all" ? "tab-btn--active" : ""}`}
            onClick={() => handleFilterChange("all")}
          >
            {labels.all} ({total})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unread"}
            className={`tab-btn ${filter === "unread" ? "tab-btn--active" : ""}`}
            onClick={() => handleFilterChange("unread")}
          >
            {labels.unread} ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleMarkAllRead}
          >
            <CheckCheck size={16} aria-hidden="true" />
            {labels.markAllRead}
          </button>
        )}
      </div>

      {loading ? (
        <div className="notifications-inbox__loading">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-inbox__empty">
          <Bell size={36} aria-hidden="true" />
          <p>{filter === "unread" ? labels.emptyUnread : labels.empty}</p>
        </div>
      ) : (
        <ul className="notifications-list">
          {notifications.map((n) => {
            const kindLabel = labels.kinds[n.kind] ?? n.kind;
            return (
              <li
                key={n.id}
                className={`notification-row ${
                  n.is_read ? "" : "notification-row--unread"
                }`}
              >
                <div className="notification-row__main">
                  <div className="notification-row__badge-line">
                    <span className="notification-kind-badge">{kindLabel}</span>
                    <time
                      dateTime={n.created_at}
                      className="notification-row__time"
                    >
                      {new Date(n.created_at).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <h3 className="notification-row__title">{n.title}</h3>
                  <p className="notification-row__body">{n.body}</p>
                </div>

                <div className="notification-row__actions">
                  {!n.is_read && (
                    <button
                      type="button"
                      className="notification-row__btn"
                      onClick={() => handleMarkRead(n.id)}
                      title="Mark as read"
                    >
                      <Check size={16} />
                      <span className="sr-only">Mark as read</span>
                    </button>
                  )}
                  {n.action_url && (
                    <Link
                      href={`/${locale}${
                        n.action_url.startsWith("/") ? n.action_url : "/" + n.action_url
                      }`}
                      className="notification-row__link"
                    >
                      <ExternalLink size={16} />
                      <span className="sr-only">Open linked page</span>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
