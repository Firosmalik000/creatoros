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

export async function getAdminOverviewServer(): Promise<PlatformOverview | null> {
  const result = await serverFetch<AdminEnvelope<PlatformOverview>>(
    "admin/overview",
  );
  return result?.data ?? null;
}

export async function listAdminUsersServer(params?: {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminUser> | null> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.set("role", params.role);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return serverFetch<AdminPaginatedEnvelope<AdminUser>>(
    `admin/users${query ? `?${query}` : ""}`,
  );
}

export async function getAdminUserServer(
  userID: string,
): Promise<AdminUser | null> {
  const result = await serverFetch<AdminEnvelope<AdminUser>>(
    `admin/users/${encodeURIComponent(userID)}`,
  );
  return result?.data ?? null;
}

export async function listAdminOrdersServer(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminOrder> | null> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return serverFetch<AdminPaginatedEnvelope<AdminOrder>>(
    `admin/orders${query ? `?${query}` : ""}`,
  );
}

export async function listAdminCampaignsServer(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminCampaign> | null> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return serverFetch<AdminPaginatedEnvelope<AdminCampaign>>(
    `admin/campaigns${query ? `?${query}` : ""}`,
  );
}

export async function listAdminDisputesServer(params?: {
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<OrderDispute> | null> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return serverFetch<AdminPaginatedEnvelope<OrderDispute>>(
    `admin/disputes${query ? `?${query}` : ""}`,
  );
}

export async function getAdminFinanceOverviewServer(): Promise<AdminFinanceSummary | null> {
  const result = await serverFetch<AdminEnvelope<AdminFinanceSummary>>(
    "admin/finance/overview",
  );
  return result?.data ?? null;
}

export async function listAdminCategoriesServer(): Promise<AdminCategory[]> {
  const result = await serverFetch<AdminEnvelope<AdminCategory[]>>(
    "admin/categories",
  );
  return result?.data ?? [];
}

export async function listAdminAuditLogsServer(params?: {
  action?: string;
  resource_type?: string;
  page?: number;
  per_page?: number;
}): Promise<AdminPaginatedEnvelope<AdminAuditLog> | null> {
  const searchParams = new URLSearchParams();
  if (params?.action) searchParams.set("action", params.action);
  if (params?.resource_type)
    searchParams.set("resource_type", params.resource_type);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  const query = searchParams.toString();
  return serverFetch<AdminPaginatedEnvelope<AdminAuditLog>>(
    `admin/audit-logs${query ? `?${query}` : ""}`,
  );
}

export async function listAdminAnnouncementsServer(): Promise<
  AdminAnnouncement[]
> {
  const result = await serverFetch<AdminEnvelope<AdminAnnouncement[]>>(
    "admin/announcements",
  );
  return result?.data ?? [];
}
