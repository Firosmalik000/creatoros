import { readCSRFToken, type ApiError } from "@/lib/auth-client";
import type {
  ConversationThread,
  Message,
  Notification,
  NotificationPreferences,
  CommunicationEnvelope,
  CommunicationPaginatedEnvelope,
  UnreadCountData,
} from "./communication-types";

const knownCommunicationErrorCodes = new Set([
  "invalid_request",
  "validation_failed",
  "forbidden",
  "unauthenticated",
  "not_found",
  "empty_message",
  "message_too_long",
  "internal_error",
  "unknown_error",
]);

export function normalizeCommunicationErrorCode(code: string): string {
  return knownCommunicationErrorCodes.has(code) ? code : "unknown_error";
}

export async function communicationRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const csrfToken = readCSRFToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`/api/communication/${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: ApiError;
    } | null;
    throw (
      payload?.error ?? {
        code: "unknown_error",
        message: "The request could not be completed.",
      }
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ── Messaging ─────────────────────────────────────────────────────────────

export async function getOrderThread(orderID: string): Promise<ConversationThread> {
  const res = await communicationRequest<CommunicationEnvelope<ConversationThread>>(
    `orders/${orderID}/thread`,
  );
  return res.data;
}

export async function listThreadMessages(
  threadID: string,
  since?: string,
  limit = 50,
): Promise<Message[]> {
  const query = new URLSearchParams();
  if (since) query.set("since", since);
  if (limit) query.set("limit", limit.toString());
  const queryString = query.toString();
  const url = `threads/${threadID}/messages${queryString ? `?${queryString}` : ""}`;
  const res = await communicationRequest<CommunicationEnvelope<Message[]>>(url);
  return res.data;
}

export async function sendMessage(
  threadID: string,
  body: string,
): Promise<Message> {
  const res = await communicationRequest<CommunicationEnvelope<Message>>(
    `threads/${threadID}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
  return res.data;
}

// ── Notifications ─────────────────────────────────────────────────────────

export async function listNotifications(
  unreadOnly = false,
  limit = 20,
  offset = 0,
): Promise<{ notifications: Notification[]; total: number }> {
  const query = new URLSearchParams({
    unread_only: unreadOnly ? "true" : "false",
    limit: limit.toString(),
    offset: offset.toString(),
  });
  const res = await communicationRequest<CommunicationPaginatedEnvelope<Notification>>(
    `notifications?${query.toString()}`,
  );
  return { notifications: res.data, total: res.total };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await communicationRequest<CommunicationEnvelope<UnreadCountData>>(
    "notifications/unread-count",
  );
  return res.data.count;
}

export async function markNotificationRead(notificationID: string): Promise<void> {
  await communicationRequest<void>(`notifications/${notificationID}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await communicationRequest<void>("notifications/read-all", {
    method: "POST",
  });
}

// ── Preferences ───────────────────────────────────────────────────────────

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await communicationRequest<CommunicationEnvelope<NotificationPreferences>>(
    "user/notification-preferences",
  );
  return res.data;
}

export async function updateNotificationPreferences(input: {
  email_notifications?: boolean;
  order_updates?: boolean;
  messages?: boolean;
}): Promise<NotificationPreferences> {
  const res = await communicationRequest<CommunicationEnvelope<NotificationPreferences>>(
    "user/notification-preferences",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  return res.data;
}
