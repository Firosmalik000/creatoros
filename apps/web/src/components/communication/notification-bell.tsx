"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Notification } from "@/lib/communication-types";
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/communication-client";

type Props = {
  locale: string;
  labels: {
    title: string;
    markAllRead: string;
    empty: string;
    viewAll: string;
  };
};

export function NotificationBell({ locale, labels }: Props) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll unread count every 15 seconds
  useEffect(() => {
    let active = true;
    async function fetchCount() {
      try {
        const count = await getUnreadNotificationCount();
        if (active) setUnreadCount(count);
      } catch {
        // Silently ignore if unauthenticated
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function toggleDropdown() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setLoading(true);
      try {
        const { notifications: list } = await listNotifications(false, 5, 0);
        setNotifications(list);
      } catch {
        // Silently ignore
      } finally {
        setLoading(false);
      }
    }
  }

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={toggleDropdown}
        aria-label={`${labels.title} (${unreadCount} unread)`}
        aria-expanded={isOpen}
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown" role="region" aria-label={labels.title}>
          <div className="notification-dropdown__header">
            <h3 className="notification-dropdown__title">{labels.title}</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-dropdown__mark-all"
                onClick={handleMarkAllRead}
              >
                <Check size={14} aria-hidden="true" />
                {labels.markAllRead}
              </button>
            )}
          </div>

          <div className="notification-dropdown__body">
            {loading ? (
              <div className="notification-dropdown__loading">Loading…</div>
            ) : notifications.length === 0 ? (
              <p className="notification-dropdown__empty">{labels.empty}</p>
            ) : (
              <ul className="notification-dropdown__list">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`notification-dropdown__item ${
                      n.is_read ? "" : "notification-dropdown__item--unread"
                    }`}
                  >
                    <div className="notification-dropdown__item-content">
                      <p className="notification-dropdown__item-title">{n.title}</p>
                      <p className="notification-dropdown__item-body">{n.body}</p>
                      <span className="notification-dropdown__item-time">
                        {new Date(n.created_at).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="notification-dropdown__item-actions">
                      {!n.is_read && (
                        <button
                          type="button"
                          className="notification-dropdown__read-btn"
                          onClick={() => handleMarkRead(n.id)}
                          title="Mark read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {n.action_url && (
                        <Link
                          href={`/${locale}${n.action_url.startsWith("/") ? n.action_url : "/" + n.action_url}`}
                          className="notification-dropdown__link"
                          onClick={() => setIsOpen(false)}
                        >
                          <ExternalLink size={14} />
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="notification-dropdown__footer">
            <Link
              href={`/${locale}/notifications`}
              className="notification-dropdown__view-all"
              onClick={() => setIsOpen(false)}
            >
              {labels.viewAll}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
