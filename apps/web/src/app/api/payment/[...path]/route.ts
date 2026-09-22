import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

const UUID = "[0-9a-f-]{36}";

function backendPath(path: string): string | null {
  // GET /api/payment/orders/:id/payments
  const orderPayment = path.match(
    new RegExp(`^orders/(${UUID})/payments$`, "i"),
  );
  if (orderPayment) return `/orders/${orderPayment[1]}/payments`;

  // POST /api/payment/orders/:id/escrow/release
  const escrowRelease = path.match(
    new RegExp(`^orders/(${UUID})/escrow/release$`, "i"),
  );
  if (escrowRelease) return `/orders/${escrowRelease[1]}/escrow/release`;

  // GET /api/payment/creator/wallet
  if (path === "creator/wallet") return "/creator/wallet";

  // GET|POST /api/payment/creator/payout-methods
  if (path === "creator/payout-methods") return "/creator/payout-methods";

  // GET|POST /api/payment/creator/payouts
  if (path === "creator/payouts") return "/creator/payouts";

  // POST /api/payment/admin/payouts/:id/process
  const processPayoutAdmin = path.match(
    new RegExp(`^admin/payouts/(${UUID})/process$`, "i"),
  );
  if (processPayoutAdmin)
    return `/admin/payouts/${processPayoutAdmin[1]}/process`;

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
          message: "Payment service is unavailable.",
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
