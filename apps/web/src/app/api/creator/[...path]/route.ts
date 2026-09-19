import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

function backendPath(path: string) {
  if (path === "catalog") return "/catalog/creator-options";
  if (path === "onboarding") return "/creators/me/onboarding";
  if (path === "submit") return "/creators/me/verification-submissions";
  if (path === "admin") return "/admin/creator-verifications";
  const detail = path.match(/^admin\/([0-9a-f-]{36})$/i);
  if (detail) return `/admin/creator-verifications/${detail[1]}`;
  const decision = path.match(/^admin\/([0-9a-f-]{36})\/decision$/i);
  if (decision) return `/admin/creator-verifications/${decision[1]}/decisions`;
  return null;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  const path = backendPath(segments.join("/"));
  if (!path) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Route not found." } },
      { status: 404 },
    );
  }

  const baseURL = process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";
  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const csrfToken = request.headers.get("x-csrf-token");
  if (contentType) headers.set("Content-Type", contentType);
  if (cookie) headers.set("Cookie", cookie);
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  let backendResponse: Response;
  try {
    backendResponse = await fetch(
      `${baseURL}${path}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await request.text(),
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "Creator service is unavailable.",
        },
      },
      { status: 502 },
    );
  }

  const body =
    backendResponse.status === 204 ? null : await backendResponse.text();
  const response = new NextResponse(body, { status: backendResponse.status });
  response.headers.set("Cache-Control", "no-store, private");
  const responseContentType = backendResponse.headers.get("content-type");
  if (responseContentType)
    response.headers.set("Content-Type", responseContentType);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
