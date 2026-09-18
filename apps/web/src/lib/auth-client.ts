export type ApiError = {
  code: string;
  message: string;
};

const knownAuthErrorCodes = new Set([
  "invalid_request",
  "validation_failed",
  "email_exists",
  "invalid_credentials",
  "email_not_verified",
  "account_disabled",
  "invalid_token",
  "unauthenticated",
  "invalid_csrf",
  "service_unavailable",
  "rate_limited",
  "internal_error",
  "unknown_error",
  "password_mismatch",
]);

export function normalizeAuthErrorCode(code: string) {
  return knownAuthErrorCodes.has(code) ? code : "unknown_error";
}

export function readCSRFToken() {
  if (typeof document === "undefined") return "";
  const item = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("creatoros_csrf="));
  return item ? decodeURIComponent(item.split("=").slice(1).join("=")) : "";
}

export async function authRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const csrfToken = readCSRFToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`/api/auth/${path}`, {
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
