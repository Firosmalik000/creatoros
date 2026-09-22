import { readCSRFToken, type ApiError } from "@/lib/auth-client";
import type { UploadedFile } from "./workflow-types";

const knownWorkflowErrorCodes = new Set([
  "invalid_request",
  "validation_failed",
  "forbidden",
  "unauthenticated",
  "not_found",
  "conflict",
  "invalid_transition",
  "revision_limit_exceeded",
  "file_too_large",
  "unsupported_media_type",
  "service_unavailable",
  "internal_error",
  "unknown_error",
]);

export function normalizeWorkflowErrorCode(code: string): string {
  return knownWorkflowErrorCodes.has(code) ? code : "unknown_error";
}

export async function workflowRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const csrfToken = readCSRFToken();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`/api/workflow/${path}`, {
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

export async function uploadDeliverable(
  orderID: string,
  file: File,
): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await workflowRequest<{ data: UploadedFile }>(
    `orders/${orderID}/submissions/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  return res.data;
}
