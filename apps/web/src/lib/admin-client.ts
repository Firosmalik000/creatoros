import { readCSRFToken, type ApiError } from "@/lib/auth-client";
import type {
  AdminEnvelope,
  AdminPaginatedEnvelope,
  PlatformOverview,
  AdminUser,
  AdminOrder,
  AdminCampaign,
  OrderDispute,
  AdminFinanceSummary,
  AdminCategory,
  AdminAuditLog,
  AdminAnnouncement,
} from "./admin-types";

export async function adminRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const csrfToken = readCSRFToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`/api/admin/${path}`, {
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

// ── Overview ───────────────────────────────────────────────────────────────

export async function getAdminOverview(): Promise<PlatformOverview> {
  return adminRequest<AdminEnvelope<PlatformOverview>>("overview").then(
    (r) => r.data,
  );
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function listAdminUsers(params?: {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminUser>> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.set("role", params.role);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return adminRequest<AdminPaginatedEnvelope<AdminUser>>(
    `users${query ? `?${query}` : ""}`,
  );
}

export async function getAdminUser(userID: string): Promise<AdminUser> {
  return adminRequest<AdminEnvelope<AdminUser>>(
    `users/${encodeURIComponent(userID)}`,
  ).then((r) => r.data);
}

export async function updateAdminUserStatus(
  userID: string,
  status: "active" | "disabled",
  reason: string,
): Promise<{ success: boolean }> {
  return adminRequest<AdminEnvelope<{ success: boolean }>>(
    `users/${encodeURIComponent(userID)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    },
  ).then((r) => r.data);
}

export async function updateAdminUserRoles(
  userID: string,
  roles: string[],
): Promise<{ success: boolean }> {
  return adminRequest<AdminEnvelope<{ success: boolean }>>(
    `users/${encodeURIComponent(userID)}/roles`,
    {
      method: "PUT",
      body: JSON.stringify({ roles }),
    },
  ).then((r) => r.data);
}

// ── Orders & Campaigns ─────────────────────────────────────────────────────

export async function listAdminOrders(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminOrder>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return adminRequest<AdminPaginatedEnvelope<AdminOrder>>(
    `orders${query ? `?${query}` : ""}`,
  );
}

export async function listAdminCampaigns(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminCampaign>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return adminRequest<AdminPaginatedEnvelope<AdminCampaign>>(
    `campaigns${query ? `?${query}` : ""}`,
  );
}

// ── Disputes ───────────────────────────────────────────────────────────────

export async function listAdminDisputes(params?: {
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<OrderDispute>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return adminRequest<AdminPaginatedEnvelope<OrderDispute>>(
    `disputes${query ? `?${query}` : ""}`,
  );
}

export async function resolveAdminDispute(
  orderID: string,
  resolution: "client_refund" | "creator_payout" | "dismiss",
  notes: string,
): Promise<{ success: boolean }> {
  return adminRequest<AdminEnvelope<{ success: boolean }>>(
    `disputes/${encodeURIComponent(orderID)}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ resolution, notes }),
    },
  ).then((r) => r.data);
}

// ── Finance ────────────────────────────────────────────────────────────────

export async function getAdminFinanceOverview(): Promise<AdminFinanceSummary> {
  return adminRequest<AdminEnvelope<AdminFinanceSummary>>(
    "finance/overview",
  ).then((r) => r.data);
}

// ── Categories ─────────────────────────────────────────────────────────────

export async function listAdminCategories(): Promise<AdminCategory[]> {
  return adminRequest<AdminEnvelope<AdminCategory[]>>("categories").then(
    (r) => r.data,
  );
}

export async function createAdminCategory(input: {
  slug: string;
  name_id: string;
  name_en: string;
  name_ms: string;
  sort_order: number;
  is_active: boolean;
}): Promise<AdminCategory> {
  return adminRequest<AdminEnvelope<AdminCategory>>("categories", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

export async function updateAdminCategory(
  categoryID: string,
  input: {
    name_id: string;
    name_en: string;
    name_ms: string;
    sort_order: number;
    is_active: boolean;
  },
): Promise<AdminCategory> {
  return adminRequest<AdminEnvelope<AdminCategory>>(
    `categories/${encodeURIComponent(categoryID)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  ).then((r) => r.data);
}

// ── Audit Logs ─────────────────────────────────────────────────────────────

export async function listAdminAuditLogs(params?: {
  action?: string;
  resource_type?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminAuditLog>> {
  const searchParams = new URLSearchParams();
  if (params?.action) searchParams.set("action", params.action);
  if (params?.resource_type)
    searchParams.set("resource_type", params.resource_type);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return adminRequest<AdminPaginatedEnvelope<AdminAuditLog>>(
    `audit-logs${query ? `?${query}` : ""}`,
  );
}

// ── Announcements ──────────────────────────────────────────────────────────

export async function listAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  return adminRequest<AdminEnvelope<AdminAnnouncement[]>>("announcements").then(
    (r) => r.data,
  );
}

export async function createAdminAnnouncement(input: {
  title: string;
  body: string;
  target_role: string;
}): Promise<AdminAnnouncement> {
  return adminRequest<AdminEnvelope<AdminAnnouncement>>("announcements", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.data);
}
