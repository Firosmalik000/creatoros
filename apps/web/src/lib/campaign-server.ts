import {
  normalizeCampaign,
  normalizeMatchedCreator,
  type Campaign,
  type CampaignInvitation,
  type CampaignMatchedCreator,
} from "@/lib/campaign-types";
import { cookies } from "next/headers";

const apiBase = () =>
  process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function getClientCampaigns(): Promise<Campaign[]> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(`${apiBase()}/campaigns`, {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data: unknown[] };
    return (json.data ?? []).map(normalizeCampaign);
  } catch {
    return [];
  }
}

export async function getCampaignDetails(
  campaignID: string,
): Promise<Campaign | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(
      `${apiBase()}/campaigns/${encodeURIComponent(campaignID)}`,
      {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { data: unknown };
    return json.data ? normalizeCampaign(json.data) : null;
  } catch {
    return null;
  }
}

export async function getCampaignMatchesServer(
  campaignID: string,
): Promise<CampaignMatchedCreator[]> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(
      `${apiBase()}/campaigns/${encodeURIComponent(campaignID)}/matches`,
      {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      },
    );
    if (!response.ok) return [];
    const json = (await response.json()) as { data: unknown[] };
    return (json.data ?? []).map(normalizeMatchedCreator);
  } catch {
    return [];
  }
}

export async function getCreatorCampaignInvitations(): Promise<
  CampaignInvitation[]
> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(`${apiBase()}/creator/campaign-invitations`, {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data: CampaignInvitation[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function getPublicCampaignsServer(params?: {
  category_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Campaign[]; total: number }> {
  try {
    const q = new URLSearchParams();
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));

    const queryString = q.toString() ? `?${q.toString()}` : "";
    const response = await fetch(`${apiBase()}/campaigns/explore${queryString}`, {
      cache: "no-store",
    });
    if (!response.ok) return { data: [], total: 0 };
    const json = (await response.json()) as {
      data: unknown[];
      meta?: { total: number };
    };
    return {
      data: (json.data ?? []).map(normalizeCampaign),
      total: json.meta?.total ?? (json.data ?? []).length,
    };
  } catch {
    return { data: [], total: 0 };
  }
}

