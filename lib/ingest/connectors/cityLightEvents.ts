import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// City Light Studio's "BBQ" events widget, used by several Colorado downtown /
// chamber sites (e.g. boulderdowntown.com). The page is a thin shell; the events
// load from an open data API
// (xapi.citylightstudio.net/_bbq/_bbq_results.php?fid=…&key=…) that returns an
// HTML fragment grouped by date: each `.bbq-row` carries a `.bbq-row-date`
// header and a list of `li` events, each with `.lnk-primary` (title) and
// `.lnk-secondary` ("<time> / <venue> [/ <area>]"). Set `url` to that API URL
// and `linkBase` to the display site (to resolve the "/do/<slug>" links).
export async function fetchCityLightEvents(source: SourceConfig): Promise<RawItem[]> {
  const apiUrl = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!apiUrl) throw new Error(`source ${source.id} missing url`);

  const html = await withRetry(async () => {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`citylight fetch failed: status ${res.status}`);
    return res.text();
  });

  const $ = cheerio.load(html);
  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];

  $(".bbq-row").each((_, row) => {
    const $row = $(row);
    const date = $row.find(".bbq-row-date").first().text().replace(/\s+/g, " ").trim();
    if (!date) return;
    $row.find(".bbq-row-list li").each((_i, li) => {
      const $li = $(li);
      const title = $li.find(".lnk-primary").first().text().replace(/\s+/g, " ").trim();
      if (!title) return;
      // "7:15am / Boulder Civic Area / Boulder Creek" → time = first segment,
      // venue = the rest.
      const detail = $li.find(".lnk-secondary").first().text().replace(/\s+/g, " ").trim();
      const parts = detail.split("/").map((s) => s.trim()).filter(Boolean);
      const time = parts[0] ?? "";
      const venue = parts.slice(1).join(", ");

      const href = $li.find("a").first().attr("href");
      const sourceId = `${source.id}:${createHash("sha1").update(`${title}|${date}`).digest("hex").slice(0, 12)}`;
      if (seen.has(sourceId)) return;
      seen.add(sourceId);

      const text = [title, `Date: ${date}`, time ? `Time: ${time}` : null, venue ? `Venue: ${venue}` : null]
        .filter(Boolean)
        .join("\n");
      out.push({
        sourceId,
        sourceUrl: href && source.linkBase ? new URL(href, source.linkBase).href : (href ?? apiUrl),
        text,
        venueName: venue || undefined,
        fetchedAt,
      });
    });
  });

  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
