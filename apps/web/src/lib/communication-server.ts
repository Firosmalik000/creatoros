import type {
  ConversationThread,
  Notification,
  NotificationPreferences,
  CommunicationEnvelope,
  CommunicationPaginatedEnvelope,
  UnreadCountData,
} from "@/lib/communication-types";
import { cookies } from "next/headers";

const apiBase = () =>
  process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(`${apiBase()}/${path}`, {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getServerOrderThread(
  orderID: string,
): Promise<ConversationThread | null> {
  const result = await serverFetch<CommunicationEnvelope<ConversationThread>>(
    `orders/${encodeURIComponent(orderID)}/thread`,
  );
  return result?.data ?? null;
}

export async function getServerNotifications(
  unreadOnly = false,
  limit = 20,
  offset = 0,
): Promise<{ notifications: Notification[]; total: number }> {
  const query = new URLSearchParams({
    unread_only: unreadOnly ? "true" : "false",
    limit: limit.toString(),
    offset: offset.toString(),
  });
  const result = await serverFetch<
    CommunicationPaginatedEnvelope<Notification>
  >(`notifications?${query.toString()}`);
  return { notifications: result?.data ?? [], total: result?.total ?? 0 };
}

export async function getServerUnreadNotificationCount(): Promise<number> {
  const result = await serverFetch<CommunicationEnvelope<UnreadCountData>>(
    "notifications/unread-count",
  );
  return result?.data.count ?? 0;
}

export async function getServerNotificationPreferences(): Promise<NotificationPreferences | null> {
  const result = await serverFetch<
    CommunicationEnvelope<NotificationPreferences>
  >("user/notification-preferences");
  return result?.data ?? null;
}
