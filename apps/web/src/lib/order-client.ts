import { readCSRFToken, type ApiError } from "@/lib/auth-client";

const knownOrderErrorCodes = new Set([
  "invalid_request",
  "validation_failed",
  "forbidden",
  "unauthenticated",
  "not_found",
  "conflict",
  "invalid_transition",
  "self_order_forbidden",
  "service_unavailable",
  "internal_error",
  "unknown_error",
]);

export function normalizeOrderErrorCode(code: string): string {
  return knownOrderErrorCodes.has(code) ? code : "unknown_error";
}

export async function orderRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const csrfToken = readCSRFToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`/api/order/${path}`, {
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
