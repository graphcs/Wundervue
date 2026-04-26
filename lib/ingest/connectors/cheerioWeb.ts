import * as cheerio from "cheerio";
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
    const image = selectors.image ? $el.find(selectors.image).first().attr("src") : undefined;
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
