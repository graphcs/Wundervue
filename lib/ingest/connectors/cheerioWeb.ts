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
    const ticketHref = selectors.ticketLink
      ? $el.find(selectors.ticketLink).first().attr("href")
      : undefined;
    const text = [title, date, description].filter(Boolean).join("\n");
    if (!text) return;

    const sourceUrl = link
      ? new URL(link, url).toString()
      : url;
    const ticketUrl = ticketHref ? new URL(ticketHref, url).toString() : undefined;

    // Dedup by the per-event link when the item has its own — the same event can
    // appear under several list/category pages (e.g. Boulder's event_category
    // views), and keying those by url alone collapses them to one row. Fall back
    // to url+contentHash for items that only share the list page URL, where the
    // hash is the sole discriminator between distinct events.
    const hasOwnLink = Boolean(link) && !urls.includes(sourceUrl);
    const contentHash = createHash("sha1").update(text).digest("hex").slice(0, 12);
    const sourceId = hasOwnLink
      ? `${source.id}:${sourceUrl}`
      : `${source.id}:${sourceUrl}#${contentHash}`;
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    items.push({
      sourceId,
      sourceUrl,
      ticketUrl,
      text,
      imageUrl: image ? new URL(image, url).toString() : undefined,
      fetchedAt,
    });
    });
  }

  const capped = source.maxItems ? items.slice(0, source.maxItems) : items;

  // Opt-in detail enrichment: fetch each kept item's own page and append the
  // detail block (the list card often omits the time the detail page carries).
  // Sequential to stay polite to one host; only items with their own link (a
  // sourceUrl distinct from the list page) are fetched.
  if (source.detailSelector) {
    for (const it of capped) {
      if (!it.sourceUrl || urls.includes(it.sourceUrl)) continue;
      try {
        // Retry + timeout so a transient hiccup doesn't silently leave the event
        // time-less (the whole point of the fetch). A real 404 throws past the
        // retries and is caught below.
        const detailHtml = await withRetry(async () => {
          const res = await fetch(it.sourceUrl!, {
            headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
            signal: AbortSignal.timeout(20000),
          });
          if (!res.ok) throw new Error(`detail fetch ${res.status}`);
          return res.text();
        });
        const $d = cheerio.load(detailHtml);
        const detail = $d(source.detailSelector).first().text().replace(/\s+/g, " ").trim();
        if (detail) {
          // Surface a clean "Time: …" line so normalize reads it deterministically
          // (mid-blob times get skipped under concurrent normalization).
          const tm = detail.match(
            /\b\d{1,2}(?::\d{2})?\s*[AP]M\s*[–-]\s*\d{1,2}(?::\d{2})?\s*[AP]M\b|\b\d{1,2}:\d{2}\s*[AP]M\b/i,
          );
          const timeLine = tm ? `Time: ${tm[0]}\n` : "";
          it.text = `${it.text}\n${timeLine}${detail.slice(0, 1000)}`;
        }
      } catch {
        // detail enrichment is best-effort — keep the list-only item on failure
      }
    }
  }

  return capped;
}

