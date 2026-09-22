export interface AdminEnvelope<T> {
  data: T;
}

export interface AdminPaginatedEnvelope<T> {
  data: T[];
  total: number;
}

export interface PlatformOverview {
  total_users: number;
  total_creators: number;
  total_clients: number;
  total_orders: number;
  total_campaigns: number;
  total_gmv_minor: number;
  escrow_held_minor: number;
  commission_earned_minor: number;
  currency: string;
  pending_verifications: number;
  active_disputes: number;
  pending_payouts: number;
  timestamp: string;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  status: "active" | "disabled" | "pending_verification";
  preferred_locale: string;
  created_at: string;
  roles: string[];
}

export interface AdminOrder {
  id: string;
  client_id: string;
  client_email: string;
  client_name: string;
  creator_id: string;
  creator_name: string;
  service_name: string;
  package_name: string;
  price_minor: number;
  currency: string;
  status: string;
  created_at: string;
  has_dispute: boolean;
  dispute_status?: string;
  dispute_reason?: string;
}

export interface AdminCampaign {
  id: string;
  title: string;
  client_id: string;
  client_email: string;
  client_name: string;
  budget_minor: number;
  currency: string;
  target_creators: number;
  status: string;
  created_at: string;
}

export type DisputeStatus =
  | "opened"
  | "under_review"
  | "resolved_client_refund"
  | "resolved_creator_payout"
  | "dismissed";

export interface OrderDispute {
  id: string;
  order_id: string;
  initiator_user_id: string;
  reason: string;
  status: DisputeStatus;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminFinanceSummary {
  total_gmv_minor: number;
  total_escrow_minor: number;
  total_commissions_minor: number;
  total_payouts_settled_minor: number;
  pending_payouts_count: number;
  pending_payouts_sum_minor: number;
  currency: string;
}

export interface AdminCategory {
  id: string;
  slug: string;
  name_id: string;
  name_en: string;
  name_ms: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  actor_user_id?: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  target_role: string;
  is_active: boolean;
  starts_at: string;
  ends_at?: string;
  created_at: string;
  updated_at: string;
}
