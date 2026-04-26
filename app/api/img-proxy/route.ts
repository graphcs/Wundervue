import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// Hosts we're willing to proxy. Anything outside this allowlist is rejected,
// so this endpoint can't be used as an open SSRF / bandwidth proxy.
const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
];

function isAllowed(url: string): URL | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname;
    if (!ALLOWED_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const target = request.nextUrl.searchParams.get("u");
  if (!target) return new Response("missing u", { status: 400 });
  const url = isAllowed(target);
  if (!url) return new Response("host not allowed", { status: 400 });

  try {
    // Server-side fetch — no Referer header by default, so Instagram's hotlink
    // protection doesn't apply.
    const upstream = await fetch(url, {
      headers: { "User-Agent": "WundervueImgProxy/1.0" },
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response("not an image", { status: 415 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        // Long cache; the underlying Instagram URL has signed query params that
        // expire, but the bytes themselves don't change.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("[img-proxy] fetch failed", err);
    return new Response("upstream error", { status: 502 });
  }
}
