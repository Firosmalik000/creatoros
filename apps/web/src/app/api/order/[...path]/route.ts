import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

function backendPath(path: string): string | null {
  if (path === "orders") return "/orders";

  const orderDetail = path.match(/^orders\/([0-9a-f-]{36})$/i);
  if (orderDetail) return `/orders/${orderDetail[1]}`;

  const orderCancel = path.match(/^orders\/([0-9a-f-]{36})\/cancel$/i);
  if (orderCancel) return `/orders/${orderCancel[1]}/cancel`;

  const orderBriefs = path.match(/^orders\/([0-9a-f-]{36})\/briefs$/i);
  if (orderBriefs) return `/orders/${orderBriefs[1]}/briefs`;

  if (path === "creator/orders") return "/creator/orders";

  const creatorOrderDetail = path.match(/^creator\/orders\/([0-9a-f-]{36})$/i);
  if (creatorOrderDetail) return `/creator/orders/${creatorOrderDetail[1]}`;

  const creatorOrderAction = path.match(
    /^creator\/orders\/([0-9a-f-]{36})\/(accept|decline)$/i,
  );
  if (creatorOrderAction)
    return `/creator/orders/${creatorOrderAction[1]}/${creatorOrderAction[2]}`;

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
          message: "Order service is unavailable.",
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
