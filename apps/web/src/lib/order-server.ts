import type { Order, OrderDetail, OrderEnvelope } from "@/lib/order-types";
import { cookies } from "next/headers";

const apiBase = () =>
  process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function getClientOrders(): Promise<Order[]> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(`${apiBase()}/orders`, {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    if (!response.ok) return [];
    return ((await response.json()) as OrderEnvelope<Order[]>).data;
  } catch {
    return [];
  }
}

export async function getClientOrderDetail(
  orderID: string,
): Promise<OrderDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(
      `${apiBase()}/orders/${encodeURIComponent(orderID)}`,
      {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      },
    );
    if (!response.ok) return null;
    return ((await response.json()) as OrderEnvelope<OrderDetail>).data;
  } catch {
    return null;
  }
}

export async function getCreatorOrders(): Promise<Order[]> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(`${apiBase()}/creator/orders`, {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    if (!response.ok) return [];
    return ((await response.json()) as OrderEnvelope<Order[]>).data;
  } catch {
    return [];
  }
}

export async function getCreatorOrderDetail(
  orderID: string,
): Promise<OrderDetail | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(
      `${apiBase()}/creator/orders/${encodeURIComponent(orderID)}`,
      {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      },
    );
    if (!response.ok) return null;
    return ((await response.json()) as OrderEnvelope<OrderDetail>).data;
  } catch {
    return null;
  }
}
