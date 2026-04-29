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
            // Lazy-loading sites stash the real URL in srcset/data-* and leave
            // src holding a 1x1 placeholder. Mirror lib/ingest/connectors/cheerioWeb.ts
            // pickImageAttr — kept in sync by hand since this runs in Apify's worker.
            function isUsable(v) {
              if (!v) return false;
              const t = String(v).trim();
              return t.length > 0 && !t.startsWith('data:') && t !== 'about:blank';
            }
            function pickFromSrcset(srcset) {
              if (!srcset) return null;
              const candidates = srcset.split(',').map(e => {
                const parts = e.trim().split(/\\s+/);
                return parts[0] && isUsable(parts[0]) ? { url: parts[0], desc: parts[1] || '' } : null;
              }).filter(Boolean);
              if (candidates.length === 0) return null;
              let bestW = -1, bestWUrl = null, bestX = -1, bestXUrl = null;
              for (const c of candidates) {
                const wm = /^(\\d+(?:\\.\\d+)?)w$/.exec(c.desc);
                if (wm) { const w = +wm[1]; if (w > bestW) { bestW = w; bestWUrl = c.url; } continue; }
                const xm = /^(\\d+(?:\\.\\d+)?)x$/.exec(c.desc);
                if (xm) { const x = +xm[1]; if (x > bestX) { bestX = x; bestXUrl = c.url; } }
              }
              return bestWUrl || bestXUrl || candidates[0].url;
            }
            function pickImage($img) {
              const fromSrcset = pickFromSrcset($img.attr('srcset'));
              if (fromSrcset) return fromSrcset;
              for (const a of ['data-src', 'data-lazy-src', 'data-original']) {
                const v = $img.attr(a);
                if (isUsable(v)) return v;
              }
              const src = $img.attr('src');
              return isUsable(src) ? src : null;
            }
            if (itemSel) {
              $(itemSel).each((_, el) => {
                items.push({
                  url: $(el).find('a').first().attr('href') || request.url,
                  title: $(el).find(titleSel).first().text().trim(),
                  description: $(el).find(descSel).first().text().trim(),
                  text: $(el).text().trim(),
                  image: pickImage($(el).find('img').first()),
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
