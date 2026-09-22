import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

const UUID = "[0-9a-f-]{36}";

function backendPath(path: string): string | null {
  // GET /api/communication/orders/:id/thread
  const orderThread = path.match(new RegExp(`^orders/(${UUID})/thread$`, "i"));
  if (orderThread) return `/orders/${orderThread[1]}/thread`;

  // GET|POST /api/communication/threads/:id/messages
  const threadMessages = path.match(
    new RegExp(`^threads/(${UUID})/messages$`, "i"),
  );
  if (threadMessages) return `/threads/${threadMessages[1]}/messages`;

  // GET /api/communication/notifications
  if (path === "notifications") return "/notifications";

  // GET /api/communication/notifications/unread-count
  if (path === "notifications/unread-count") return "/notifications/unread-count";

  // POST /api/communication/notifications/:id/read
  const markRead = path.match(new RegExp(`^notifications/(${UUID})/read$`, "i"));
  if (markRead) return `/notifications/${markRead[1]}/read`;

  // POST /api/communication/notifications/read-all
  if (path === "notifications/read-all") return "/notifications/read-all";

  // GET|PUT /api/communication/user/notification-preferences
  if (path === "user/notification-preferences")
    return "/user/notification-preferences";

  // GET /api/communication/stream
  if (path === "stream" || path === "notifications/stream")
    return "/communication/notifications/stream";

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
          message: "Communication service is unavailable.",
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
