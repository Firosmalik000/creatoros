import type {
  ApiEnvelope,
  CreatorCatalog,
  DirectoryCreator,
  PublicCreatorProfile,
} from "@/lib/creator-types";
import { cookies } from "next/headers";

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

export async function getCreatorDirectory(
  locale: string,
  searchParams: URLSearchParams = new URLSearchParams(),
) {
  const baseURL = process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";
  const params = new URLSearchParams(searchParams);
  params.set("locale", locale);
  try {
    const cookieHeader = (await cookies()).toString();
    const response = await fetch(`${baseURL}/creators?${params.toString()}`, {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    if (!response.ok)
      return { data: [], meta: { page: 1, per_page: 24, total: 0 } };
    return (await response.json()) as {
      data: DirectoryCreator[];
      meta: { page: number; per_page: number; total: number };
    };
  } catch {
    return { data: [], meta: { page: 1, per_page: 24, total: 0 } };
  }
}

export async function getCreatorCatalog(locale: string) {
  const baseURL = process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";
  try {
    const response = await fetch(
      `${baseURL}/catalog/creator-options?locale=${encodeURIComponent(locale)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      return { platforms: [], categories: [] } satisfies CreatorCatalog;
    const payload = (await response.json()) as ApiEnvelope<CreatorCatalog>;
    return payload.data;
  } catch {
    return { platforms: [], categories: [] } satisfies CreatorCatalog;
  }
}
