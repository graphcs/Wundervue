import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { localizeDenver } from "./localize";

// Wix Events powers many small-venue sites (e.g. Little Blue Pigeon Books). The
// events page is a JS app, but Wix server-embeds the data in a
// `<script id="wix-warmup-data">` JSON blob, so we fetch the HTML and parse that
// rather than rendering the page. Configure with `connector: "wixEvents"` and
// the events page `url`.
const WIX_MEDIA_BASE = "https://static.wixstatic.com/media/";

interface WixEvent {
  id?: string;
  title?: string;
  slug?: string;
  description?: string;
  about?: string;
  mainImage?: { id?: string } | string;
  scheduling?: { config?: { startDate?: string } };
  start?: string;
  startDate?: string;
  location?: { name?: string; address?: string };
}

function* walk(node: unknown): Iterable<Record<string, unknown>> {
  if (node && typeof node === "object") {
    yield node as Record<string, unknown>;
    for (const key of Object.keys(node as Record<string, unknown>)) {
      yield* walk((node as Record<string, unknown>)[key]);
    }
  }
}

function eventStart(e: WixEvent): string | undefined {
  return e.scheduling?.config?.startDate ?? e.start ?? e.startDate;
}


function eventImage(e: WixEvent): string | undefined {
  const id = typeof e.mainImage === "string" ? e.mainImage : e.mainImage?.id;
  return id ? `${WIX_MEDIA_BASE}${id}` : undefined;
}

function plainText(v: unknown): string {
  return typeof v === "string" ? v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export async function fetchWixEvents(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single url`);
  }
  const url = source.url;
  const html = await withRetry(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
    });
    if (!res.ok) throw new Error(`fetch ${url} failed: status ${res.status}`);
    return res.text();
  });

  const $ = cheerio.load(html);
  let blob = "";
  $("script").each((_i, el) => {
    if (/warmup/i.test($(el).attr("id") ?? "")) blob = $(el).text();
  });
  if (!blob) throw new Error(`source ${source.id}: no wix-warmup-data found`);
  const data = JSON.parse(blob);

  const origin = new URL(url).origin;
  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (const node of walk(data)) {
    const e = node as WixEvent;
    // Event-like: has a title, a *resolved* start date, and an identity
    // (slug/id). Requiring an actual start (not just the presence of a
    // `scheduling` key) drops non-event config objects and dateless rows.
    const start = eventStart(e);
    if (!e.title?.trim() || !start) continue;
    const sourceId = String(e.id ?? e.slug ?? "");
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);
    const desc = plainText(e.description) || plainText(e.about);
    const loc = e.location?.name || e.location?.address || "";
    const text = [
      e.title.trim(),
      start && `Date: ${localizeDenver(start)}`,
      loc && `Location: ${loc}`,
      desc,
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      sourceUrl: e.slug ? `${origin}/event-details/${e.slug}` : url,
      text,
      imageUrl: eventImage(e),
      fetchedAt,
      venueName: e.location?.name ?? undefined,
    });
  }

  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
