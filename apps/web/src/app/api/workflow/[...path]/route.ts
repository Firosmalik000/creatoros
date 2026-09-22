import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

function backendPath(path: string): string | null {
  const submissions = path.match(/^orders\/([0-9a-f-]{36})\/submissions$/i);
  if (submissions) return `/orders/${submissions[1]}/submissions`;

  const upload = path.match(/^orders\/([0-9a-f-]{36})\/submissions\/upload$/i);
  if (upload) return `/orders/${upload[1]}/submissions/upload`;

  const revision = path.match(
    /^orders\/([0-9a-f-]{36})\/submissions\/([0-9a-f-]{36})\/revision$/i,
  );
  if (revision)
    return `/orders/${revision[1]}/submissions/${revision[2]}/revision`;

  const approve = path.match(
    /^orders\/([0-9a-f-]{36})\/submissions\/([0-9a-f-]{36})\/approve$/i,
  );
  if (approve) return `/orders/${approve[1]}/submissions/${approve[2]}/approve`;

  const file = path.match(/^submissions\/files\/([0-9a-f-]{36})$/i);
  if (file) return `/submissions/files/${file[1]}`;

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
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const csrfToken = request.headers.get("x-csrf-token");
  if (contentType) headers.set("Content-Type", contentType);
  if (cookie) headers.set("Cookie", cookie);
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  let requestBody: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      requestBody = await request.arrayBuffer();
    } else {
      requestBody = await request.text();
    }
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(
      `${baseURL}${path}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body: requestBody,
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "Workflow service is unavailable.",
        },
      },
      { status: 502 },
    );
  }

  if (backendResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Cache-Control", "no-store, private");

  const responseContentType = backendResponse.headers.get("content-type");
  if (responseContentType) {
    responseHeaders.set("Content-Type", responseContentType);
  }
  const contentDisposition = backendResponse.headers.get("content-disposition");
  if (contentDisposition) {
    responseHeaders.set("Content-Disposition", contentDisposition);
  }
  const contentLength = backendResponse.headers.get("content-length");
  if (contentLength) {
    responseHeaders.set("Content-Length", contentLength);
  }

  const arrayBuffer = await backendResponse.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
