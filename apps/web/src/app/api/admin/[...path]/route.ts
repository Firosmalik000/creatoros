import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

const UUID = "[0-9a-f-]{36}";

function backendPath(path: string): string | null {
  // GET /api/admin/overview
  if (path === "overview") return "/admin/overview";

  // GET /api/admin/users
  if (path === "users") return "/admin/users";

  // GET /api/admin/users/:id
  const userDetail = path.match(new RegExp(`^users/(${UUID})$`, "i"));
  if (userDetail) return `/admin/users/${userDetail[1]}`;

  // PATCH /api/admin/users/:id/status
  const userStatus = path.match(new RegExp(`^users/(${UUID})/status$`, "i"));
  if (userStatus) return `/admin/users/${userStatus[1]}/status`;

  // PUT /api/admin/users/:id/roles
  const userRoles = path.match(new RegExp(`^users/(${UUID})/roles$`, "i"));
  if (userRoles) return `/admin/users/${userRoles[1]}/roles`;

  // GET /api/admin/orders
  if (path === "orders") return "/admin/orders";

  // GET /api/admin/campaigns
  if (path === "campaigns") return "/admin/campaigns";

  // GET /api/admin/disputes
  if (path === "disputes") return "/admin/disputes";

  // POST /api/admin/disputes/:id/resolve
  const resolveDispute = path.match(
    new RegExp(`^disputes/(${UUID})/resolve$`, "i"),
  );
  if (resolveDispute) return `/admin/disputes/${resolveDispute[1]}/resolve`;

  // GET /api/admin/finance/overview
  if (path === "finance/overview") return "/admin/finance/overview";

  // GET|POST /api/admin/categories
  if (path === "categories") return "/admin/categories";

  // PUT /api/admin/categories/:id
  const categoryDetail = path.match(new RegExp(`^categories/(${UUID})$`, "i"));
  if (categoryDetail) return `/admin/categories/${categoryDetail[1]}`;

  // GET /api/admin/audit-logs
  if (path === "audit-logs") return "/admin/audit-logs";

  // GET|POST /api/admin/announcements
  if (path === "announcements") return "/admin/announcements";

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
  const search = request.nextUrl.search;
  const targetURL = `${baseURL}${path}${search}`;

  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const csrfToken = request.headers.get("x-csrf-token");
  if (contentType) headers.set("Content-Type", contentType);
  if (cookie) headers.set("Cookie", cookie);
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetURL, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? await request.text()
          : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "Unable to reach the backend service.",
        },
      },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  const resContentType = backendResponse.headers.get("content-type");
  if (resContentType) responseHeaders.set("Content-Type", resContentType);

  // Forward Set-Cookie if present
  const setCookie = backendResponse.headers.get("set-cookie");
  if (setCookie) responseHeaders.set("Set-Cookie", setCookie);

  const body = await backendResponse.text();
  return new NextResponse(body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const dynamic = "force-dynamic";
