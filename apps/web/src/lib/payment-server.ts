import type {
  Payment,
  CreatorWalletDetail,
  PayoutMethod,
  PayoutRequest,
  PaymentEnvelope,
} from "@/lib/payment-types";
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

export async function getOrderPayment(
  orderID: string,
): Promise<Payment | null> {
  const result = await serverFetch<PaymentEnvelope<Payment>>(
    `orders/${encodeURIComponent(orderID)}/payments`,
  );
  return result?.data ?? null;
}

export async function getCreatorWallet(): Promise<CreatorWalletDetail | null> {
  const result =
    await serverFetch<PaymentEnvelope<CreatorWalletDetail>>("creator/wallet");
  return result?.data ?? null;
}

export async function getCreatorPayoutMethods(): Promise<PayoutMethod[]> {
  const result = await serverFetch<PaymentEnvelope<PayoutMethod[]>>(
    "creator/payout-methods",
  );
  return result?.data ?? [];
}

export async function getCreatorPayouts(): Promise<PayoutRequest[]> {
  const result = await serverFetch<PaymentEnvelope<PayoutRequest[]>>(
    "creator/payouts",
  );
  return result?.data ?? [];
}
