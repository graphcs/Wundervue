import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";

// Canonical implementation of "best image URL from an <img>" — used both by
// the in-process cheerio scraper and by the Apify worker (via toString()
// embedding below). Keep these as plain top-level function declarations: TS
// annotations are erased at compile time, but Function.prototype.toString()
// in our runtimes (tsx, Next server, Vitest) returns the compiled JS form,
// which Apify's worker then evaluates. Avoid TS-only constructs whose erasure
// would leave behind broken syntax.

export function isUsableUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:")) return false;
  if (trimmed === "about:blank") return false;
  return true;
}

export function pickFromSrcset(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  const candidates = srcset
    .split(",")
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return null;
      // "URL [DESCRIPTOR]" — descriptor is optional (Nw, Nx) and split by
      // whitespace. URLs themselves don't contain whitespace per the spec.
      const parts = trimmed.split(/\s+/);
      const url = parts[0];
      const desc = parts[1] ?? "";
      if (!isUsableUrl(url)) return null;
      return { url, desc };
    })
    .filter((c): c is { url: string; desc: string } => c !== null);

  if (candidates.length === 0) return undefined;

  let bestW = -1;
  let bestWUrl: string | undefined;
  let bestX = -1;
  let bestXUrl: string | undefined;
  for (const c of candidates) {
    const wMatch = /^(\d+(?:\.\d+)?)w$/.exec(c.desc);
    if (wMatch) {
      const w = Number(wMatch[1]);
      if (w > bestW) {
        bestW = w;
        bestWUrl = c.url;
      }
      continue;
    }
    const xMatch = /^(\d+(?:\.\d+)?)x$/.exec(c.desc);
    if (xMatch) {
      const x = Number(xMatch[1]);
      if (x > bestX) {
        bestX = x;
        bestXUrl = c.url;
      }
    }
  }

  return bestWUrl ?? bestXUrl ?? candidates[0].url;
}

// Extracts the best image URL from an <img> element, accounting for lazy-load
// libraries that put a placeholder (or nothing) in `src` and stash the real
// URL in srcset/data-* attributes. Order:
//
//   1. srcset — pick the candidate with the largest `w` descriptor, falling
//      back to the largest `x` (density) descriptor, then first entry.
//   2. data-src / data-lazy-src / data-original / data-image — common
//      lazy-load attrs (data-image is used by Red Rocks' theme and other WP
//      lazy-loaders).
//   3. src — last because it often holds a 1×1 placeholder on lazy sites.
//
// Skips obvious placeholder values: empty strings, `data:` URIs (inline
// base64), and `about:blank`.
export function pickImageAttr($el: Cheerio<Element>): string | undefined {
  const fromSrcset = pickFromSrcset($el.attr("srcset"));
  if (fromSrcset) return fromSrcset;

  for (const attr of ["data-src", "data-lazy-src", "data-original", "data-image"] as const) {
    const value = $el.attr(attr);
    if (isUsableUrl(value)) return value;
  }

  const src = $el.attr("src");
  if (isUsableUrl(src)) return src;

  return undefined;
}

// Concatenated source of the three helpers above, intended for embedding into
// remote-execution contexts (Apify worker pageFunction) so they evaluate the
// exact same logic the in-process cheerio scraper runs. Order matters:
// pickFromSrcset references isUsableUrl, pickImageAttr references both — so
// we emit isUsableUrl first.
export const IMAGE_PICKER_SOURCE = [
  isUsableUrl.toString(),
  pickFromSrcset.toString(),
  pickImageAttr.toString(),
].join("\n\n");
