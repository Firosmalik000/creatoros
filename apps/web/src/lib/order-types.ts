export type OrderStatus =
  | "pending_acceptance"
  | "accepted"
  | "declined"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "disputed";

export type Order = {
  id: string;
  client_user_id: string;
  client_display_name?: string;
  creator_user_id: string;
  creator_display_name?: string;
  creator_slug?: string;
  service_id: string;
  service_title?: string;
  package_id: string;
  package_name: string;
  package_description: string;
  price_minor: number;
  currency: "IDR" | "MYR" | "USD";
  delivery_days: number;
  revision_limit: number;
  brief_content: string;
  status: OrderStatus;
  accepted_at?: string | null;
  deadline_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type BriefVersion = {
  id: string;
  order_id: string;
  version: number;
  content: string;
  submitted_by: string;
  submitted_by_name?: string;
  created_at: string;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  actor_user_id: string;
  actor_name?: string;
  from_status: string;
  to_status: string;
  note?: string;
  created_at: string;
};

export type OrderDetail = Order & {
  briefs: BriefVersion[];
  events: OrderEvent[];
};

export type OrderEnvelope<T> = { data: T };
