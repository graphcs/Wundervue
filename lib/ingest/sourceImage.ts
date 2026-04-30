// Pulls the canonical preview image from a source HTML page. Most event /
// venue sites set <meta property="og:image"> (Open Graph) or
// <meta name="twitter:image"> for social-card previews — those URLs point at
// the full-resolution original, not a downscaled CDN proxy like SerpAPI's
// gstatic thumbnails. Used as the FIRST real fallback in the image pipeline
// (after we confirm the row doesn't already point at our Storage bucket),
// because publisher OG tags are tuned for full-resolution social cards and
// almost always beat the connector-supplied thumbnail.
//
// Returns null on every failure mode (network, oversized body, missing tag,
// malformed URL). The reason is logged at the bail site so cron-triggered
// runs leave a diagnosable trail when an upstream silently changes.

const FETCH_TIMEOUT_MS = 8000;
// Stop reading after this many bytes — og:image lives in <head> within the
// first ~10KB of any reasonable page. Reading the full body just bloats memory
// and slows the pipeline down for large landing pages.
const HEAD_BYTE_BUDGET = 65536;
// Hard cap regardless of the head budget: if the page is suspiciously large
// (or the server lies about chunk sizes), bail rather than buffer megabytes
// of HTML we don't need. Anything bigger than this on the og:image path is a
// misconfiguration we shouldn't pay memory for.
const MAX_RESPONSE_BYTES = 1_048_576;

export async function extractOgImageFromUrl(pageUrl: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some sites serve different markup to bots; match what a normal
        // browser would request so og:image is rendered into the head.
        "User-Agent":
          "Mozilla/5.0 (compatible; WundervueBot/1.0; +https://wundervue.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    console.warn(`[og-image] fetch failed for ${pageUrl}`, err);
    return null;
  }
  if (!res.ok) {
    console.warn(`[og-image] http ${res.status} for ${pageUrl}`);
    return null;
  }
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("html")) {
    console.warn(`[og-image] non-html content-type "${ct || "(none)"}" for ${pageUrl}`);
    return null;
  }

  // Upfront Content-Length guard: honest servers tell us if the body is
  // larger than we're willing to read. This is purely an optimization — the
  // streaming counter below catches the same case after one chunk if CL is
  // missing or chunked-encoding is in play.
  const clHeader = res.headers.get("content-length");
  if (clHeader) {
    const cl = Number.parseInt(clHeader, 10);
    if (Number.isFinite(cl) && cl > MAX_RESPONSE_BYTES) {
      console.warn(
        `[og-image] content-length ${cl} > ${MAX_RESPONSE_BYTES} cap for ${pageUrl}`,
      );
      return null;
    }
  }

  const reader = res.body?.getReader();
  if (!reader) {
    console.warn(`[og-image] response had no readable body for ${pageUrl}`);
    return null;
  }
  let html = "";
  let bytesRead = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      // Bail on a single oversized chunk before paying to decode it. Without
      // this, a server returning a 100MB chunk on the first read would have
      // already been buffered into memory by the time we noticed.
      if (bytesRead > MAX_RESPONSE_BYTES) {
        console.warn(
          `[og-image] streaming bytes ${bytesRead} > ${MAX_RESPONSE_BYTES} cap for ${pageUrl}`,
        );
        return null;
      }
      html += decoder.decode(value, { stream: true });
      // Don't bother continuing past </head>; og: tags can't appear after
      // that, and the head budget is a soft cap on how much we'll accumulate
      // looking for the meta tag.
      if (html.length >= HEAD_BYTE_BUDGET) break;
      if (html.includes("</head>") || html.includes("</HEAD>")) break;
    }
  } finally {
    void reader.cancel().catch((err) => {
      console.debug(`[og-image] reader cancel failed for ${pageUrl}`, err);
    });
  }

  return parseSocialPreviewImage(html, pageUrl);
}

export function parseSocialPreviewImage(html: string, baseUrl: string): string | null {
  // Try og:image first, then twitter:image (covers the few sites that only set
  // the latter). We accept either property=/name= attribute order, single or
  // double quotes, and either attribute order around the meta tag.
  const candidates = [
    /<meta[^>]+property=['"]og:image(?::secure_url)?['"][^>]+content=['"]([^'"]+)['"][^>]*>/i,
    /<meta[^>]+content=['"]([^'"]+)['"][^>]+property=['"]og:image(?::secure_url)?['"][^>]*>/i,
    /<meta[^>]+name=['"]twitter:image['"][^>]+content=['"]([^'"]+)['"][^>]*>/i,
    /<meta[^>]+content=['"]([^'"]+)['"][^>]+name=['"]twitter:image['"][^>]*>/i,
  ];
  for (const re of candidates) {
    const match = re.exec(html);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        // Malformed candidate URL — try the next regex (e.g. og:image broken
        // but twitter:image still valid) instead of giving up entirely.
        console.warn(
          `[og-image] malformed url candidate "${match[1]}" on ${baseUrl}`,
        );
        continue;
      }
    }
  }
  return null;
}
