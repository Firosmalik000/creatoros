export type NotificationKind =
  | "order_update"
  | "submission_received"
  | "revision_requested"
  | "submission_approved"
  | "payment_received"
  | "escrow_released"
  | "payout_update"
  | "campaign_invitation"
  | "campaign_response"
  | "new_message"
  | "system";

export type ConversationParticipant = {
  thread_id: string;
  user_id: string;
  user_display_name?: string;
  last_read_at: string;
  joined_at: string;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  sender_name?: string;
  body: string;
  created_at: string;
};

export type ConversationThread = {
  id: string;
  order_id?: string;
  campaign_id?: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  messages?: Message[];
};

export type Notification = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  action_url: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  email_notifications: boolean;
  order_updates: boolean;
  messages: boolean;
  updated_at: string;
};

export type CommunicationEnvelope<T> = {
  data: T;
};

export type CommunicationPaginatedEnvelope<T> = {
  data: T[];
  total: number;
};

export type UnreadCountData = {
  count: number;
};
