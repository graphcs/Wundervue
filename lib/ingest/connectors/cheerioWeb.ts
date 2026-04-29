import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

export async function fetchCheerioWeb(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || !source.selectors) {
    throw new Error(`source ${source.id} missing url or selectors`);
  }
  const url = source.url;
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
  const fetchedAt = new Date().toISOString();
  const items: RawItem[] = [];

  $(selectors.item).each((idx, el) => {
    const $el = $(el);
    const title = selectors.title ? $el.find(selectors.title).first().text().trim() : "";
    const description = selectors.description
      ? $el.find(selectors.description).first().text().trim()
      : "";
    const date = selectors.date ? $el.find(selectors.date).first().text().trim() : "";
    const link = selectors.link ? $el.find(selectors.link).first().attr("href") : undefined;
    const image = selectors.image ? pickImageAttr($el.find(selectors.image).first()) : undefined;
    const text = [title, date, description].filter(Boolean).join("\n");
    if (!text) return;

    const sourceUrl = link
      ? new URL(link, url).toString()
      : url;

    items.push({
      sourceId: `${source.id}:${sourceUrl}#${idx}`,
      sourceUrl,
      text,
      imageUrl: image ? new URL(image, url).toString() : undefined,
      fetchedAt,
    });
  });

  return items;
}

// Extracts the best image URL from an <img> element, accounting for lazy-load
// libraries that put a placeholder (or nothing) in `src` and stash the real
// URL in srcset/data-* attributes. Order:
//
//   1. srcset — pick the candidate with the largest `w` descriptor, falling
//      back to the largest `x` (density) descriptor, then first entry.
//   2. data-src / data-lazy-src / data-original — common lazy-load attrs.
//   3. src — last because it often holds a 1×1 placeholder on lazy sites.
//
// Skips obvious placeholder values: empty strings, `data:` URIs (inline
// base64), and `about:blank`.
export function pickImageAttr($el: Cheerio<Element>): string | undefined {
  const fromSrcset = pickFromSrcset($el.attr("srcset"));
  if (fromSrcset) return fromSrcset;

  for (const attr of ["data-src", "data-lazy-src", "data-original"] as const) {
    const value = $el.attr(attr);
    if (isUsableUrl(value)) return value;
  }

  const src = $el.attr("src");
  if (isUsableUrl(src)) return src;

  return undefined;
}

function pickFromSrcset(srcset: string | undefined): string | undefined {
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

function isUsableUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:")) return false;
  if (trimmed === "about:blank") return false;
  return true;
}
