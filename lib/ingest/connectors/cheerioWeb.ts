import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { pickImageAttr } from "./imagePicker";

// Re-exported so existing consumers (and the unit test) keep importing from
// the connector module. Canonical implementation lives in ./imagePicker so
// the Apify worker can embed the same source.
export { pickImageAttr } from "./imagePicker";

// WordPress's media library appends a "-WxH" suffix to resized derivative
// URLs (e.g. "...photo-500x500.jpg"). The original full-resolution upload
// lives at the same path without that suffix. Card thumbnails are often
// below our probe's size floor (600x400), so swapping in the original gets
// us a usable image with zero AI generation. Safe fallback: if the
// stripped URL 404s, the probe rejects it and the pipeline falls through
// to og:image / AI gen — same as if we hadn't transformed.
export function stripWpResize(url: string): string {
  return url.replace(/-\d+x\d+(\.(?:jpg|jpeg|png|webp|avif|gif))(\?|#|$)/i, "$1$2");
}

// CityKit's image CDN (used by tourism-board sites — RiNo Art District,
// LoDo Love, etc.) serves square 900x900 transforms by default
// (`/tr:w-900,h-900,fo-auto/...`). Those fail our probe's landscape
// aspect floor (1.2-2.4) and trip AI gen on every event. The CDN
// supports custom transforms, so rewrite the `tr:` segment to a 3:2
// landscape that comfortably passes both the size and aspect checks.
export function forceCtykitLandscape(url: string): string {
  if (!url.includes("img.ctykit.com")) return url;
  return url.replace(/\/tr:[^/]+\//, "/tr:w-1200,h-800,fo-auto/");
}

// Compose all known per-CDN URL rewrites. Keep additions narrow — each
// only triggers when the URL pattern matches.
function normalizeImageUrl(url: string): string {
  return forceCtykitLandscape(stripWpResize(url));
}

async function fetchOne(source: SourceConfig, url: string): Promise<RawItem[]> {
  if (!source.selectors) {
    throw new Error(`source ${source.id} missing selectors`);
  }
  const selectors = source.selectors;

  const html = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) {
      throw new Error(`fetch ${url} failed: status ${res.status}`);
    }
    return res.text();
  });

  const $ = cheerio.load(html);
  // Strip page chrome before applying selectors so a body-as-item config
  // doesn't pick up the nav/footer text — common shape for "every event has
  // its own page" sites.
  $("script,style,nav,footer,header,noscript").remove();
  const fetchedAt = new Date().toISOString();
  const items: RawItem[] = [];

  const limit = source.maxItems;
  $(selectors.item).each((_idx, el) => {
    if (limit !== undefined && items.length >= limit) return false;
    const $el = $(el);
    const title = selectors.title ? $el.find(selectors.title).first().text().trim() : "";
    const description = selectors.description
      ? $el.find(selectors.description).first().text().replace(/\s+/g, " ").trim()
      : "";
    const date = selectors.date ? $el.find(selectors.date).first().text().trim() : "";
    // Some sites (RiNo Art District's evcards) put href on the item
    // element itself instead of an inner <a> — common for "click anywhere
    // on the card" patterns that hydrate via JS. find() doesn't include
    // self, so fall back to the item's own href when the selector misses.
    const link =
      (selectors.link ? $el.find(selectors.link).first().attr("href") : undefined) ??
      $el.attr("href");
    const image = selectors.image ? pickImageAttr($el.find(selectors.image).first()) : undefined;
    const text = [title, date, description].filter(Boolean).join("\n");
    if (!text) return;

    const sourceUrl = link
      ? new URL(link, url).toString()
      : url;

    // Content-hash the visible text instead of using the array index, so re-runs
    // against a re-ordered DOM still upsert the same row. When `link` is present
    // sourceUrl is already item-unique; when absent (all items share the page
    // url) the hash is the only stable discriminator.
    const contentHash = createHash("sha1").update(text).digest("hex").slice(0, 12);

    items.push({
      sourceId: `${source.id}:${sourceUrl}#${contentHash}`,
      sourceUrl,
      text,
      imageUrl: image ? normalizeImageUrl(new URL(image, url).toString()) : undefined,
      fetchedAt,
    });
  });

  return items;
}

export async function fetchCheerioWeb(source: SourceConfig): Promise<RawItem[]> {
  const urls = source.urls ?? (source.url ? [source.url] : []);
  if (urls.length === 0) {
    throw new Error(`source ${source.id} missing url/urls`);
  }
  if (urls.length === 1) {
    return fetchOne(source, urls[0]);
  }
  // For multi-URL sources, swallow per-URL failures so one bad page doesn't
  // abort the whole run — the failure streak guard already handles total
  // outages.
  const all: RawItem[] = [];
  for (const u of urls) {
    try {
      const items = await fetchOne(source, u);
      all.push(...items);
    } catch (err) {
      console.error(`[cheerioWeb:${source.id}] fetch failed for ${u}`, err);
    }
  }
  return all;
}

