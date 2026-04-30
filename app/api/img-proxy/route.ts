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
    // protection doesn't apply. The timeout bounds upstream stalls so a few
    // hung fbcdn connections can't exhaust route concurrency / function
    // compute on Vercel.
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(8000),
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
    // Distinguish AbortSignal timeout from other failures: a timeout is a
    // transient upstream stall (504 Gateway Timeout, retry-worthy), other
    // errors (DNS, TLS, connection reset) look more like a permanent gateway
    // problem (502). The client-side retry policy can use this signal.
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    console.error(
      `[img-proxy] fetch ${isTimeout ? "timed out" : "failed"} for ${url.href}`,
      err,
    );
    return new Response(isTimeout ? "upstream timeout" : "upstream error", {
      status: isTimeout ? 504 : 502,
    });
  }
}
