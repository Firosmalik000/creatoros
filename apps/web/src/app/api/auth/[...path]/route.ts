import { NextRequest, NextResponse } from "next/server";

const allowedPaths = new Set([
  "register",
  "verify-email",
  "login",
  "logout",
  "forgot-password",
  "reset-password",
  "me",
  "settings",
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function backendPath(path: string) {
  if (path === "settings") return "/users/me/settings";
  return `/auth/${path}`;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  const path = segments.join("/");
  if (!allowedPaths.has(path)) {
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
    backendResponse = await fetch(`${baseURL}${backendPath(path)}`, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "Authentication service is unavailable.",
        },
      },
      { status: 502 },
    );
  }

  const body =
    backendResponse.status === 204 ? null : await backendResponse.text();
  const response = new NextResponse(body, { status: backendResponse.status });
  const responseContentType = backendResponse.headers.get("content-type");
  if (responseContentType)
    response.headers.set("Content-Type", responseContentType);
  for (const setCookie of backendResponse.headers.getSetCookie()) {
    response.headers.append("Set-Cookie", setCookie);
  }
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
