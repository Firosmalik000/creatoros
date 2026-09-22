export type CampaignStatus = "draft" | "active" | "completed" | "cancelled";

export type CampaignVisibility = "public" | "private";

export type CampaignInvitationStatus =
  | "invited"
  | "applied"
  | "accepted"
  | "declined"
  | "selected"
  | "rejected";

export type CampaignRequirementInput = {
  platform_id?: string | null;
  category_id?: string | null;
  min_followers?: number;
  min_engagement_rate?: number;
  deliverable_type?: string;
  quantity?: number;
};

export type CampaignRequirement = {
  id: string;
  campaign_id: string;
  platform_id?: string | null;
  category_id?: string | null;
  platform_name?: string | null;
  category_name?: string | null;
  min_followers: number;
  min_engagement_bps: number;
  min_engagement_rate: number;
  deliverable_type: string;
  quantity: number;
  created_at: string;
};

export type CampaignInvitation = {
  id: string;
  campaign_id: string;
  creator_user_id: string;
  creator_name?: string | null;
  creator_display_name?: string | null;
  creator_slug?: string | null;
  campaign_title?: string | null;
  campaign_budget_minor?: number | null;
  campaign_currency?: "IDR" | "MYR" | "USD" | null;
  campaign_deadline?: string | null;
  status: CampaignInvitationStatus;
  pitch?: string | null;
  pitch_note?: string | null;
  proposed_rate_minor?: number | null;
  offered_fee_minor?: number | null;
  currency?: string | null;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  client_user_id: string;
  client_name?: string | null;
  client_display_name?: string | null;
  client_email?: string | null;
  title: string;
  description: string;
  budget_minor: number;
  currency: "IDR" | "MYR" | "USD";
  target_creators: number;
  deadline: string;
  status: CampaignStatus;
  visibility: CampaignVisibility;
  requirements: CampaignRequirement[];
  invitations?: CampaignInvitation[];
  created_at: string;
  updated_at: string;
};

export type CampaignMatchedCreator = {
  creator_user_id: string;
  display_name: string;
  slug: string;
  avatar_url?: string | null;
  category_name?: string | null;
  platform_name?: string | null;
  follower_count: number;
  engagement_bps: number;
  engagement_rate: number;
  match_score: number;
};

export type CreateCampaignInput = {
  title: string;
  description: string;
  budget_minor: number;
  currency: "IDR" | "MYR" | "USD";
  target_creators: number;
  deadline: string;
  visibility?: CampaignVisibility;
  requirements: CampaignRequirementInput[];
};

export type UpdateCampaignInput = CreateCampaignInput;

export type ApplyCampaignInput = {
  pitch_note: string;
  proposed_fee_minor?: number;
  currency?: "IDR" | "MYR" | "USD";
};

export type RespondInvitationInput = {
  action: "accept" | "decline";
  pitch?: string;
  proposed_rate_minor?: number;
};

export function normalizeCampaign(data: unknown): Campaign {
  if (!data || typeof data !== "object") return {} as Campaign;
  const raw = data as Record<string, unknown>;
  const base =
    raw.campaign && typeof raw.campaign === "object"
      ? { ...(raw.campaign as Record<string, unknown>), ...raw }
      : raw;

  let requirements: CampaignRequirement[] = [];
  if (Array.isArray(base.requirements)) {
    requirements = base.requirements as CampaignRequirement[];
  } else if (base.requirements && typeof base.requirements === "object") {
    const r = base.requirements as Record<string, unknown>;
    requirements = [
      {
        id: (r.id as string) ?? "",
        campaign_id: (r.campaign_id as string) ?? (base.id as string) ?? "",
        platform_id: (r.platform_id as string) ?? null,
        category_id: (r.category_id as string) ?? null,
        platform_name: (r.platform_name as string) ?? null,
        category_name: (r.category_name as string) ?? null,
        min_followers: Number(r.min_followers) || 0,
        min_engagement_bps: Number(r.min_engagement_bps) || 0,
        min_engagement_rate: (Number(r.min_engagement_bps) || 0) / 100,
        deliverable_type:
          (r.deliverable_format as string) ??
          (r.deliverable_type as string) ??
          "video",
        quantity: Number(r.quantity) || 1,
        created_at:
          (r.created_at as string) ?? (base.created_at as string) ?? "",
      },
    ];
  }

  return {
    id: (base.id as string) ?? "",
    client_user_id: (base.client_user_id as string) ?? "",
    client_name:
      ((base.client_name ?? base.client_display_name) as string) ?? null,
    client_email: (base.client_email as string) ?? null,
    title: (base.title as string) ?? "",
    description: (base.description as string) ?? "",
    budget_minor: Number(base.budget_minor) || 0,
    currency: (base.currency as "IDR" | "MYR" | "USD") ?? "IDR",
    target_creators:
      Number(base.target_creators ?? base.target_creators_count) || 1,
    deadline: ((base.deadline ?? base.deadline_at) as string) ?? "",
    status: (base.status as CampaignStatus) ?? "draft",
    visibility: (base.visibility as CampaignVisibility) || "public",
    requirements,
    invitations: (base.invitations as CampaignInvitation[]) ?? [],
    created_at: (base.created_at as string) ?? "",
    updated_at: (base.updated_at as string) ?? "",
  };
}

export function normalizeMatchedCreator(data: unknown): CampaignMatchedCreator {
  const d = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  return {
    creator_user_id: ((d.creator_user_id ?? d.user_id) as string) ?? "",
    display_name: (d.display_name as string) ?? "",
    slug: (d.slug as string) ?? "",
    avatar_url: (d.avatar_url as string) ?? null,
    category_name: (d.category_name as string) ?? null,
    platform_name: (d.platform_name as string) ?? null,
    follower_count: Number(d.follower_count) || 0,
    engagement_bps: Number(d.engagement_bps ?? d.engagement_rate_bps) || 0,
    engagement_rate:
      Number(d.engagement_rate) ||
      (Number(d.engagement_bps ?? d.engagement_rate_bps) || 0) / 100,
    match_score: Number(d.match_score) || 85,
  };
}
