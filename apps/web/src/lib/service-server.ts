import type { CreatorService, ServiceEnvelope } from "@/lib/service-types";

const apiBase = () =>
  process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function getPublicServices(creatorSlug: string) {
  try {
    const response = await fetch(
      `${apiBase()}/creators/${encodeURIComponent(creatorSlug)}/services`,
      { cache: "no-store" },
    );
    if (!response.ok) return [];
    return ((await response.json()) as ServiceEnvelope<CreatorService[]>).data;
  } catch {
    return [];
  }
}

export async function getPublicService(
  creatorSlug: string,
  serviceSlug: string,
) {
  try {
    const response = await fetch(
      `${apiBase()}/creators/${encodeURIComponent(creatorSlug)}/services/${encodeURIComponent(serviceSlug)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    return ((await response.json()) as ServiceEnvelope<CreatorService>).data;
  } catch {
    return null;
  }
}
