"use client";

import { useState } from "react";
import { Bell, CheckCircle2, AlertCircle, LoaderCircle } from "lucide-react";
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
    <section
      className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d121f]/90 border border-slate-200/90 dark:border-white/10 shadow-sm backdrop-blur-sm transition-colors"
      aria-label={labels.title}
    >
      <div className="flex items-center gap-2 mb-2">
        <Bell size={18} className="text-blue-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {labels.title}
        </h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-white/60 mb-6">
        {labels.subtitle}
      </p>

      {success && (
        <div
          className="flex items-center gap-2 p-3.5 mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm"
          role="status"
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div
          className="flex items-center gap-2 p-3.5 mb-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm"
          role="alert"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Toggle 1: Email Notifications */}
        <label
          htmlFor="pref-email"
          className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white block">
              {labels.emailNotifications}
            </span>
            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
              {labels.emailNotificationsDesc}
            </p>
          </div>
          <input
            id="pref-email"
            type="checkbox"
            className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 cursor-pointer"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
          />
        </label>

        {/* Toggle 2: Order Updates */}
        <label
          htmlFor="pref-orders"
          className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white block">
              {labels.orderUpdates}
            </span>
            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
              {labels.orderUpdatesDesc}
            </p>
          </div>
          <input
            id="pref-orders"
            type="checkbox"
            className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 cursor-pointer"
            checked={orderUpdates}
            onChange={(e) => setOrderUpdates(e.target.checked)}
          />
        </label>

        {/* Toggle 3: Messages */}
        <label
          htmlFor="pref-messages"
          className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white block">
              {labels.messages}
            </span>
            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
              {labels.messagesDesc}
            </p>
          </div>
          <input
            id="pref-messages"
            type="checkbox"
            className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 cursor-pointer"
            checked={messages}
            onChange={(e) => setMessages(e.target.checked)}
          />
        </label>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50 min-h-[44px]"
            disabled={saving}
            aria-busy={saving}
          >
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            <span>{saving ? labels.saving : labels.save}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
