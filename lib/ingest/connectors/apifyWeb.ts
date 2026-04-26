import { ApifyClient } from "apify-client";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

interface ApifyWebItem {
  url?: string;
  title?: string;
  description?: string;
  text?: string;
  image?: string;
  loadedTime?: string;
}

// cheerio-scraper exposes `$` natively in the pageFunction context and runs ~5x
// faster than web-scraper. Use web-scraper only for JS-heavy sites that need a
// real browser.
const ACTOR_ID = "apify/cheerio-scraper";

function getClient(): ApifyClient {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not set");
  }
  return new ApifyClient({ token });
}

export async function fetchApifyWeb(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url) {
    throw new Error(`source ${source.id} missing url`);
  }
  const client = getClient();

  const run = await withRetry(() =>
    client.actor(ACTOR_ID).call(
      {
        startUrls: [{ url: source.url }],
        // Default page-function returns title/description/url/image per page.
        // For source-specific extraction, override via Apify console for that actor.
        pageFunction: `
          async function pageFunction(context) {
            const { request, $ } = context;
            const items = [];
            const itemSel = ${JSON.stringify(source.selectors?.item ?? "")};
            const titleSel = ${JSON.stringify(source.selectors?.title ?? "h1, h2, h3")};
            const descSel = ${JSON.stringify(source.selectors?.description ?? "p")};
            if (itemSel) {
              $(itemSel).each((_, el) => {
                items.push({
                  url: $(el).find('a').first().attr('href') || request.url,
                  title: $(el).find(titleSel).first().text().trim(),
                  description: $(el).find(descSel).first().text().trim(),
                  text: $(el).text().trim(),
                  image: $(el).find('img').first().attr('src') || null,
                  loadedTime: new Date().toISOString(),
                });
              });
            }
            // Fallback: when the item selector matches nothing, return the
            // visible page text as a single chunk and let the LLM extract.
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
        `,
        maxRequestsPerCrawl: 1,
      },
      { timeout: 300 },
    ),
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const rows = items as ApifyWebItem[];

  return rows
    .filter((r) => (r.text ?? r.description ?? r.title)?.trim())
    .map((r, idx): RawItem => ({
      sourceId: `${source.id}:${r.url ?? idx}`,
      sourceUrl: r.url,
      text: [r.title, r.description, r.text].filter(Boolean).join("\n\n"),
      imageUrl: r.image,
      fetchedAt: r.loadedTime ?? new Date().toISOString(),
    }));
}
