import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };

function backendPath(path: string): string | null {
  if (path === "campaigns") return "/campaigns";
  if (path === "campaigns/explore") return "/campaigns/explore";

  const applyMatch = path.match(/^campaigns\/([0-9a-f-]{36})\/apply$/i);
  if (applyMatch) return `/campaigns/${applyMatch[1]}/apply`;

  const campaignMatch = path.match(/^campaigns\/([0-9a-f-]{36})$/i);
  if (campaignMatch) return `/campaigns/${campaignMatch[1]}`;

  const publishMatch = path.match(/^campaigns\/([0-9a-f-]{36})\/publish$/i);
  if (publishMatch) return `/campaigns/${publishMatch[1]}/publish`;

  const cancelMatch = path.match(/^campaigns\/([0-9a-f-]{36})\/cancel$/i);
  if (cancelMatch) return `/campaigns/${cancelMatch[1]}/cancel`;

  const completeMatch = path.match(/^campaigns\/([0-9a-f-]{36})\/complete$/i);
  if (completeMatch) return `/campaigns/${completeMatch[1]}/complete`;

  const matchesMatch = path.match(/^campaigns\/([0-9a-f-]{36})\/matches$/i);
  if (matchesMatch) return `/campaigns/${matchesMatch[1]}/matches`;

  const invitationsMatch = path.match(
    /^campaigns\/([0-9a-f-]{36})\/invitations$/i,
  );
  if (invitationsMatch) return `/campaigns/${invitationsMatch[1]}/invitations`;

  const selectMatch = path.match(
    /^campaigns\/([0-9a-f-]{36})\/invitations\/([0-9a-f-]{36})\/select$/i,
  );
  if (selectMatch)
    return `/campaigns/${selectMatch[1]}/invitations/${selectMatch[2]}/select`;

  if (path === "creator/campaign-invitations")
    return "/creator/campaign-invitations";

  const respondMatch = path.match(
    /^creator\/campaign-invitations\/([0-9a-f-]{36})\/respond$/i,
  );
  if (respondMatch)
    return `/creator/campaign-invitations/${respondMatch[1]}/respond`;

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
    requestBody = await request.text();
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
          message: "Campaign service is unavailable.",
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

  const arrayBuffer = await backendResponse.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
