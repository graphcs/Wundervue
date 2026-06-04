import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { pickImageAttr } from "./imagePicker";

// Re-exported so existing consumers (and the unit test) keep importing from
// the connector module. Canonical implementation lives in ./imagePicker so
// the Apify worker can embed the same source.
export { pickImageAttr } from "./imagePicker";

export async function fetchCheerioWeb(source: SourceConfig): Promise<RawItem[]> {
  const urls = Array.isArray(source.url) ? source.url : source.url ? [source.url] : [];
  if (urls.length === 0 || !source.selectors) {
    throw new Error(`source ${source.id} missing url or selectors`);
  }
  const selectors = source.selectors;
  const items: RawItem[] = [];
  // Dedupe by source_id within the run. A page can list the same event twice
  // (e.g. under "Today" and "This Week", or repeated promos linking the same
  // article), which would otherwise produce duplicate (source, source_id) rows
  // and fail the batch upsert with "ON CONFLICT DO UPDATE command cannot affect
  // row a second time". Mirrors the dedupe the Instagram connector does.
  const seen = new Set<string>();

  for (const url of urls) {
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

    $(selectors.item).each((_idx, el) => {
    const $el = $(el);
    const title = selectors.title ? $el.find(selectors.title).first().text().trim() : "";
    const description = selectors.description
      ? $el.find(selectors.description).first().text().trim()
      : "";
    const date = selectors.date ? $el.find(selectors.date).first().text().trim() : "";
    // Resolve the event link. Prefer the configured child selector, but fall
    // back to the item's own href (or a nested <a>) for the common pattern
    // where the whole card is itself an anchor (e.g. `<a class="card">…`).
    const link =
      (selectors.link ? $el.find(selectors.link).first().attr("href") : undefined) ??
      $el.attr("href") ??
      $el.find("a").first().attr("href");
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
    const sourceId = `${source.id}:${sourceUrl}#${contentHash}`;
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    items.push({
      sourceId,
      sourceUrl,
      text,
      imageUrl: image ? new URL(image, url).toString() : undefined,
      fetchedAt,
    });
    });
  }

  return source.maxItems ? items.slice(0, source.maxItems) : items;
}

