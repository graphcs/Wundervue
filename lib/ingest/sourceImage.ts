// Pulls the canonical preview image from a source HTML page. Most event /
// venue sites set <meta property="og:image"> (Open Graph) or
// <meta name="twitter:image"> for social-card previews — those URLs point at
// the full-resolution original, not a downscaled CDN proxy like SerpAPI's
// gstatic thumbnails. Used as a second-chance fallback in the image pipeline
// before resorting to Flux 2 Pro generation.

const FETCH_TIMEOUT_MS = 8000;
// Stop reading after this many bytes — og:image lives in <head> within the
// first ~10KB of any reasonable page. Reading the full body just bloats memory
// and slows the pipeline down for large landing pages.
const HEAD_BYTE_BUDGET = 65536;

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
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("html")) return null;

  const reader = res.body?.getReader();
  if (!reader) return null;
  let html = "";
  const decoder = new TextDecoder();
  try {
    while (html.length < HEAD_BYTE_BUDGET) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      // Don't bother continuing past </head>; og: tags can't appear after that.
      if (html.includes("</head>") || html.includes("</HEAD>")) break;
    }
  } finally {
    void reader.cancel().catch(() => {});
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
        return null;
      }
    }
  }
  return null;
}
