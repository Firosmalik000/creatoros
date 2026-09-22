"use client";

import { useState } from "react";
import type { NotificationPreferences } from "@/lib/communication-types";
import { updateNotificationPreferences } from "@/lib/communication-client";

type Props = {
  initialPreferences: NotificationPreferences | null;
  labels: {
    title: string;
    subtitle: string;
    emailNotifications: string;
    emailNotificationsDesc: string;
    orderUpdates: string;
    orderUpdatesDesc: string;
    messages: string;
    messagesDesc: string;
    save: string;
    saving: string;
    saved: string;
    saveError: string;
  };
};

export function NotificationSettingsForm({
  initialPreferences,
  labels,
}: Props) {
  const [emailNotifications, setEmailNotifications] = useState(
    initialPreferences?.email_notifications ?? true,
  );
  const [orderUpdates, setOrderUpdates] = useState(
    initialPreferences?.order_updates ?? true,
  );
  const [messages, setMessages] = useState(
    initialPreferences?.messages ?? true,
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await updateNotificationPreferences({
        email_notifications: emailNotifications,
        order_updates: orderUpdates,
        messages: messages,
      });
      setSuccess(labels.saved);
    } catch {
      setError(labels.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section" aria-label={labels.title}>
      <div className="settings-section__header">
        <h2 className="settings-section__title">{labels.title}</h2>
        <p className="settings-section__subtitle">{labels.subtitle}</p>
      </div>

      {success && (
        <p className="settings-alert settings-alert--success" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="settings-alert settings-alert--error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSave} className="notification-settings-form">
        <div className="toggle-field">
          <div className="toggle-field__info">
            <label htmlFor="pref-email" className="toggle-field__label">
              {labels.emailNotifications}
            </label>
            <p className="toggle-field__desc">{labels.emailNotificationsDesc}</p>
          </div>
          <input
            id="pref-email"
            type="checkbox"
            className="toggle-checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
          />
        </div>

        <div className="toggle-field">
          <div className="toggle-field__info">
            <label htmlFor="pref-orders" className="toggle-field__label">
              {labels.orderUpdates}
            </label>
            <p className="toggle-field__desc">{labels.orderUpdatesDesc}</p>
          </div>
          <input
            id="pref-orders"
            type="checkbox"
            className="toggle-checkbox"
            checked={orderUpdates}
            onChange={(e) => setOrderUpdates(e.target.checked)}
          />
        </div>

        <div className="toggle-field">
          <div className="toggle-field__info">
            <label htmlFor="pref-messages" className="toggle-field__label">
              {labels.messages}
            </label>
            <p className="toggle-field__desc">{labels.messagesDesc}</p>
          </div>
          <input
            id="pref-messages"
            type="checkbox"
            className="toggle-checkbox"
            checked={messages}
            onChange={(e) => setMessages(e.target.checked)}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="button button--dark"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </section>
  );
}
