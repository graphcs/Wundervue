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
      const waitMs = ${JSON.stringify(source.waitForTimeoutMs ?? 20000)};
      if (waitSel && typeof context.waitFor === "function") {
        try { await context.waitFor(waitSel, { timeoutMillis: waitMs }); } catch (e) {}
      }
      const items = [];
      const itemSel = ${JSON.stringify(source.selectors?.item ?? "")};
      const titleSel = ${JSON.stringify(source.selectors?.title ?? "h1, h2, h3")};
      const descSel = ${JSON.stringify(source.selectors?.description ?? "p")};
      const nextSel = ${JSON.stringify(source.paginateNextSelector ?? "")};
      const cap = ${JSON.stringify(source.maxItems ?? 9999)};

      ${IMAGE_PICKER_SOURCE}

      // jQuery here runs against the LIVE document, so re-querying after an AJAX
      // "next page" sees the new DOM. Dedupe across pages by href + leading text.
      const seen = new Set();
      const perProgram = new Map();
      const PER_PROGRAM = nextSel ? 3 : Infinity;
      function collect() {
        $(itemSel).each((_, el) => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href') || request.url;
          const body = $el.text().trim();
          const key = href + '|' + body.slice(0, 120);
          if (seen.has(key)) return;
          seen.add(key);
          // Cap a recurring series (one event posted as many occurrences) to the
          // soonest few so it can't flood the window. Group by a normalized URL
          // stem — strip a trailing slash, a /YYYY-MM-DD occurrence date, and
          // WordPress's "-2/-3" duplicate-slug suffix — so distinct events that
          // merely share a title are NOT merged. Fall back to title, then text,
          // only when the item has no per-event link of its own.
          const ownHref = $el.find('a').first().attr('href') || '';
          const stem = ownHref
            .replace(/\\/+$/, '')
            .replace(/\\/\\d{4}-\\d{2}-\\d{2}$/, '')
            .replace(/-\\d+$/, '');
          const prog = stem || $el.find(titleSel).first().text().trim().toLowerCase() || body.slice(0, 60);
          const n = perProgram.get(prog) || 0;
          if (n >= PER_PROGRAM) return;
          perProgram.set(prog, n + 1);
          items.push({
            url: href,
            title: $el.find(titleSel).first().text().trim(),
            description: $el.find(descSel).first().text().trim(),
            text: body,
            image: pickImageAttr($el.find('img').first()) || null,
            loadedTime: new Date().toISOString(),
          });
        });
      }
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      if (itemSel && nextSel) {
        // AJAX-paginated list (e.g. The Events Calendar's "Next Events" nav):
        // collect the visible page, click next, wait for the list to change,
        // repeat until we have enough items or the control is gone/disabled.
        for (let page = 0; page < 15 && items.length < cap; page++) {
          collect();
          const nextEl = document.querySelector(nextSel);
          if (!nextEl || nextEl.disabled || nextEl.getAttribute('aria-disabled') === 'true') break;
          const firstBefore = (document.querySelector(itemSel) || {}).textContent;
          nextEl.click();
          let changed = false;
          for (let w = 0; w < 50; w++) {
            await sleep(300);
            const f = (document.querySelector(itemSel) || {}).textContent;
            if (f && f !== firstBefore) { changed = true; break; }
          }
          if (!changed) break;
          await sleep(400);
        }
        collect();
      } else if (itemSel) {
        collect();
      }
      // Fallback: with NO item selector, return the visible page text as a
      // single chunk and let the LLM extract. When an item selector IS set but
      // matched nothing (e.g. a JS widget that didn't finish rendering this run),
      // return empty rather than dumping the whole page as one junk listing.
      if (items.length === 0 && !itemSel) {
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
      return items.slice(0, cap);
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
