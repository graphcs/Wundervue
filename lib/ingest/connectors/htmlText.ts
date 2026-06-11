import * as cheerio from "cheerio";

// Strip HTML tags and decode entities to plain, whitespace-collapsed text.
// Shared by the feed connectors (Squarespace, Tribe, WP REST, Avery, Pottery…)
// so entity handling stays consistent in one place.
export function htmlToText(html: string | undefined | null): string {
  if (!html) return "";
  return cheerio.load(`<div>${html}</div>`).text().replace(/\s+/g, " ").trim();
}
