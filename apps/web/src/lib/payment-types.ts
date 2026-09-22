export type PaymentStatus = "pending" | "escrow_held" | "released" | "refunded" | "failed";

export type Currency = "IDR" | "MYR" | "USD";

export type Payment = {
  id: string;
  order_id?: string;
  campaign_id?: string;
  client_user_id: string;
  creator_user_id: string;
  amount_minor: number;
  currency: Currency;
  status: PaymentStatus;
  payment_method: string;
  provider: string;
  provider_transaction_id: string;
  created_at: string;
  updated_at: string;
};

export type LedgerEntry = {
  id: string;
  transaction_id: string;
  reference_type: "order_escrow" | "commission" | "creator_payout" | "refund";
  reference_id: string;
  account_type:
    | "client_cash"
    | "platform_escrow"
    | "creator_balance"
    | "platform_commission"
    | "payout_reserve";
  user_id?: string;
  entry_type: "debit" | "credit";
  amount_minor: number;
  currency: Currency;
  description: string;
  created_at: string;
};

export type CreatorWallet = {
  creator_user_id: string;
  available_balance_minor: number;
  escrow_balance_minor: number;
  total_withdrawn_minor: number;
  currency: Currency;
  updated_at: string;
};

export type CreatorWalletDetail = {
  wallet: CreatorWallet;
  ledger: LedgerEntry[];
};

export type PayoutMethodType = "bank_transfer" | "e_wallet";

export type PayoutMethod = {
  id: string;
  creator_user_id: string;
  payout_type: PayoutMethodType;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type PayoutStatus = "pending" | "processing" | "completed" | "rejected";

export type PayoutRequest = {
  id: string;
  creator_user_id: string;
  payout_method_id?: string;
  amount_minor: number;
  currency: Currency;
  status: PayoutStatus;
  reference_note?: string;
  processed_at?: string;
  bank_name?: string;
  account_number?: string;
  account_holder_name?: string;
  created_at: string;
  updated_at: string;
};

export type PaymentEnvelope<T> = { data: T };
