import type { ApiEnvelope, PublicCreatorProfile } from "@/lib/creator-types";

export async function getPublicCreator(slug: string, locale: string) {
  const baseURL = process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";
  try {
    const response = await fetch(
      `${baseURL}/creators/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const payload =
      (await response.json()) as ApiEnvelope<PublicCreatorProfile>;
    return payload.data;
  } catch {
    return null;
  }
}
