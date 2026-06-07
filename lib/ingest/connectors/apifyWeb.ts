import { createHash } from "node:crypto";
import { ApifyClient } from "apify-client";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { IMAGE_PICKER_SOURCE } from "./imagePicker";

interface ApifyWebItem {
  url?: string;
  title?: string;
  description?: string;
  text?: string;
  image?: string;
  loadedTime?: string;
}

// Static cheerio-scraper (exposes `$`, ~5x faster) by default; web-scraper (a
// real browser exposing `context.jQuery` + waitFor) when a source sets
// `renderJs` for client-rendered widgets (e.g. Wix Events).
const CHEERIO_ACTOR = "apify/cheerio-scraper";
const BROWSER_ACTOR = "apify/web-scraper";

function getClient(): ApifyClient {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not set");
  }
  return new ApifyClient({ token });
}

export async function fetchApifyWeb(source: SourceConfig): Promise<RawItem[]> {
  const urls = Array.isArray(source.url) ? source.url : source.url ? [source.url] : [];
  if (urls.length === 0) {
    throw new Error(`source ${source.id} missing url`);
  }
  const client = getClient();

  // `$` is cheerio-scraper's native binding or web-scraper's injected jQuery;
  // waitFor only exists in the browser actor (guarded for the static one).
  const pageFunction = `
    async function pageFunction(context) {
      const { request } = context;
      const $ = context.$ || context.jQuery;
      const waitSel = ${JSON.stringify(source.waitForSelector ?? "")};
      if (waitSel && typeof context.waitFor === "function") {
        try { await context.waitFor(waitSel, { timeoutMillis: 20000 }); } catch (e) {}
      }
      const items = [];
      const itemSel = ${JSON.stringify(source.selectors?.item ?? "")};
      const titleSel = ${JSON.stringify(source.selectors?.title ?? "h1, h2, h3")};
      const descSel = ${JSON.stringify(source.selectors?.description ?? "p")};

      ${IMAGE_PICKER_SOURCE}

      if (itemSel) {
        $(itemSel).each((_, el) => {
          items.push({
            url: $(el).find('a').first().attr('href') || request.url,
            title: $(el).find(titleSel).first().text().trim(),
            description: $(el).find(descSel).first().text().trim(),
            text: $(el).text().trim(),
            image: pickImageAttr($(el).find('img').first()) || null,
            loadedTime: new Date().toISOString(),
          });
        });
      }
      // Fallback: when the item selector matches nothing, return the visible
      // page text as a single chunk and let the LLM extract.
      if (items.length === 0) {
        $('script, style, nav, footer, header, noscript').remove();
        const root = $('main').length ? $('main') : $('body');
        const text = root.text().replace(/\\s+/g, ' ').trim().slice(0, 8000);
        if (text) {
          items.push({
            url: request.url,
            title: $('h1').first().text().trim() || $('title').text().trim(),
            description: '',
            text,
            image: $('meta[property="og:image"]').attr('content') || null,
            loadedTime: new Date().toISOString(),
          });
        }
      }
      return items;
    }
  `;

  const baseInput: Record<string, unknown> = {
    startUrls: urls.map((url) => ({ url })),
    pageFunction,
    maxRequestsPerCrawl: urls.length,
  };
  // web-scraper needs jQuery injected for `$` and runs a full browser.
  const input = source.renderJs
    ? { ...baseInput, runMode: "PRODUCTION", injectJQuery: true }
    : baseInput;

  const run = await withRetry(() =>
    client.actor(source.renderJs ? BROWSER_ACTOR : CHEERIO_ACTOR).call(input, {
      timeout: source.renderJs ? 600 : 300,
    }),
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const rows = items as ApifyWebItem[];

  // Dedupe by source_id within the run: duplicate (source, source_id) rows
  // would fail the batch upsert with "ON CONFLICT DO UPDATE command cannot
  // affect row a second time".
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const r of rows) {
    if (!(r.text ?? r.description ?? r.title)?.trim()) continue;
    const body = [r.title, r.description, r.text].filter(Boolean).join("\n\n");
    // Content hash so re-runs against re-ordered Apify dataset output still
    // upsert the same row. r.url is usually item-unique on its own, but the
    // hash also covers the case where two items share a URL (e.g. multi-tab
    // listing pages that resolve to the same canonical link).
    const contentHash = createHash("sha1").update(body).digest("hex").slice(0, 12);
    const sourceId = `${source.id}:${r.url ?? "no-url"}#${contentHash}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    out.push({
      sourceId,
      sourceUrl: r.url,
      text: body,
      imageUrl: r.image,
      fetchedAt: r.loadedTime ?? new Date().toISOString(),
    });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
