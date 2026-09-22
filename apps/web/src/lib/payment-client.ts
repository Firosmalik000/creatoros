import { readCSRFToken, type ApiError } from "@/lib/auth-client";

const knownPaymentErrorCodes = new Set([
  "invalid_request",
  "validation_failed",
  "forbidden",
  "unauthenticated",
  "not_found",
  "conflict",
  "already_paid",
  "invalid_status",
  "insufficient_balance",
  "minimum_payout_amount",
  "invalid_signature",
  "duplicate_webhook",
  "service_unavailable",
  "internal_error",
  "unknown_error",
]);

export function normalizePaymentErrorCode(code: string): string {
  return knownPaymentErrorCodes.has(code) ? code : "unknown_error";
}

export async function paymentRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const csrfToken = readCSRFToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`/api/payment/${path}`, {
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

// ── Order Payments ───────────────────────────────────────────────────────────

export async function payOrder(
  orderID: string,
  paymentMethod = "simulated",
): Promise<import("@/lib/payment-types").Payment> {
  return paymentRequest<{ data: import("@/lib/payment-types").Payment }>(
    `orders/${encodeURIComponent(orderID)}/payments`,
    { method: "POST", body: JSON.stringify({ payment_method: paymentMethod }) },
  ).then((r) => r.data);
}

export async function releaseOrderEscrow(
  orderID: string,
): Promise<import("@/lib/payment-types").Payment> {
  return paymentRequest<{ data: import("@/lib/payment-types").Payment }>(
    `orders/${encodeURIComponent(orderID)}/escrow/release`,
    { method: "POST", body: JSON.stringify({}) },
  ).then((r) => r.data);
}

// ── Creator Wallet ───────────────────────────────────────────────────────────

export async function getPayoutMethods(): Promise<
  import("@/lib/payment-types").PayoutMethod[]
> {
  return paymentRequest<{
    data: import("@/lib/payment-types").PayoutMethod[];
  }>("creator/payout-methods").then((r) => r.data);
}

export async function savePayoutMethod(input: {
  payout_type: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
}): Promise<import("@/lib/payment-types").PayoutMethod> {
  return paymentRequest<{ data: import("@/lib/payment-types").PayoutMethod }>(
    "creator/payout-methods",
    { method: "POST", body: JSON.stringify(input) },
  ).then((r) => r.data);
}

export async function requestPayout(input: {
  amount_minor: number;
  currency: string;
  payout_method_id?: string;
}): Promise<import("@/lib/payment-types").PayoutRequest> {
  return paymentRequest<{ data: import("@/lib/payment-types").PayoutRequest }>(
    "creator/payouts",
    { method: "POST", body: JSON.stringify(input) },
  ).then((r) => r.data);
}

export async function listMyPayouts(): Promise<
  import("@/lib/payment-types").PayoutRequest[]
> {
  return paymentRequest<{
    data: import("@/lib/payment-types").PayoutRequest[];
  }>("creator/payouts").then((r) => r.data);
}
