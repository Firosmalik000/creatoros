import { readCSRFToken, type ApiError } from "@/lib/auth-client";
import {
  normalizeCampaign,
  normalizeMatchedCreator,
  type Campaign,
  type CampaignInvitation,
  type CampaignMatchedCreator,
  type CreateCampaignInput,
  type RespondInvitationInput,
  type UpdateCampaignInput,
} from "./campaign-types";

const knownCampaignErrorCodes = new Set([
  "invalid_request",
  "validation_failed",
  "forbidden",
  "unauthenticated",
  "not_found",
  "conflict",
  "invalid_transition",
  "service_unavailable",
  "internal_error",
  "unknown_error",
]);

export function normalizeCampaignErrorCode(code: string): string {
  return knownCampaignErrorCodes.has(code) ? code : "unknown_error";
}

export async function campaignRequest<T>(
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

  const response = await fetch(`/api/campaign/${path}`, {
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

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<Campaign> {
  const res = await campaignRequest<{ data: unknown }>("campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeCampaign(res.data);
}

export async function updateCampaign(
  campaignID: string,
  input: UpdateCampaignInput,
): Promise<Campaign> {
  const res = await campaignRequest<{ data: unknown }>(
    `campaigns/${campaignID}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  return normalizeCampaign(res.data);
}

export async function publishCampaign(campaignID: string): Promise<Campaign> {
  const res = await campaignRequest<{ data: unknown }>(
    `campaigns/${campaignID}/publish`,
    {
      method: "POST",
    },
  );
  return normalizeCampaign(res.data);
}

export async function cancelCampaign(campaignID: string): Promise<Campaign> {
  const res = await campaignRequest<{ data: unknown }>(
    `campaigns/${campaignID}/cancel`,
    {
      method: "POST",
    },
  );
  return normalizeCampaign(res.data);
}

export async function completeCampaign(campaignID: string): Promise<Campaign> {
  const res = await campaignRequest<{ data: unknown }>(
    `campaigns/${campaignID}/complete`,
    {
      method: "POST",
    },
  );
  return normalizeCampaign(res.data);
}

export async function getCampaignMatches(
  campaignID: string,
): Promise<CampaignMatchedCreator[]> {
  const res = await campaignRequest<{ data: unknown[] }>(
    `campaigns/${campaignID}/matches`,
    {
      method: "GET",
    },
  );
  return (res.data ?? []).map(normalizeMatchedCreator);
}

export async function createCampaignInvitation(
  campaignID: string,
  creatorUserID: string,
): Promise<CampaignInvitation> {
  const res = await campaignRequest<{ data: CampaignInvitation }>(
    `campaigns/${campaignID}/invitations`,
    {
      method: "POST",
      body: JSON.stringify({ creator_user_id: creatorUserID }),
    },
  );
  return res.data;
}

export async function selectCampaignCreator(
  campaignID: string,
  invitationID: string,
): Promise<CampaignInvitation> {
  const res = await campaignRequest<{ data: CampaignInvitation }>(
    `campaigns/${campaignID}/invitations/${invitationID}/select`,
    {
      method: "POST",
    },
  );
  return res.data;
}

export async function listCreatorCampaignInvitations(): Promise<
  CampaignInvitation[]
> {
  const res = await campaignRequest<{ data: CampaignInvitation[] }>(
    `creator/campaign-invitations`,
    {
      method: "GET",
    },
  );
  return res.data;
}

export async function respondCampaignInvitation(
  invitationID: string,
  input: RespondInvitationInput,
): Promise<CampaignInvitation> {
  const res = await campaignRequest<{ data: CampaignInvitation }>(
    `creator/campaign-invitations/${invitationID}/respond`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function applyCampaign(
  campaignID: string,
  input: { pitch_note: string; proposed_fee_minor?: number; currency?: string },
): Promise<CampaignInvitation> {
  const res = await campaignRequest<{ data: CampaignInvitation }>(
    `campaigns/${campaignID}/apply`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function exploreCampaigns(params?: {
  category_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Campaign[]; meta: { total: number; limit: number; offset: number } }> {
  const q = new URLSearchParams();
  if (params?.category_id) q.set("category_id", params.category_id);
  if (params?.search) q.set("search", params.search);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));

  const queryString = q.toString() ? `?${q.toString()}` : "";
  const res = await campaignRequest<{ data: unknown[]; meta: { total: number; limit: number; offset: number } }>(
    `campaigns/explore${queryString}`,
    {
      method: "GET",
    },
  );
  return {
    data: (res.data ?? []).map(normalizeCampaign),
    meta: res.meta ?? { total: 0, limit: 20, offset: 0 },
  };
}
