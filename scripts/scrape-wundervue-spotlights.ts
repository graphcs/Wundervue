#!/usr/bin/env tsx
/**
 * Scrape the Spotlights hover panel from wundervue.com's homepage and write
 * 9 article cards to lib/data/wundervue-spotlights.json. Run on demand:
 *   npm run scrape:spotlights
 *
 * The local SpotlightsPanel paginates these as 3 pages of 3.
 *
 * Strategy: open the homepage, hover the Spotlights nav item, find the panel
 * whose heading is "Spotlights", capture page 1 articles, click the right
 * arrow (.tipi-arrow.tipi-arrow-r, data-dir="2"), wait for the article hrefs
 * to change, capture page 2, repeat once more for page 3. Fails fast if
 * fewer than 9 unique items are captured.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = "https://wundervue.com/";
const OUTPUT_PATH = resolve(__dirname, "..", "lib", "data", "wundervue-spotlights.json");
const TARGET_COUNT = 9;
const PAGES = 3;
const PER_PAGE = 3;

type Item = { title: string; href: string; image: string };
type SpotlightsData = { items: Item[]; scrapedAt: string };

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.route("**/*", (r) => {
      if (/klaviyo/i.test(r.request().url())) return r.abort();
      return r.continue();
    });
    await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Hover the Spotlights nav item to render the panel.
    const trigger = await page.$('a:has-text("Spotlights"), button:has-text("Spotlights")');
    if (!trigger) throw new Error("Spotlights nav trigger not found");
    await trigger.hover();
    await page.waitForTimeout(1500);

    // Capture page N from the panel whose heading is "Spotlights".
    async function captureCurrentPage(): Promise<Item[]> {
      return page.evaluate(() => {
        const headings = Array.from(
          document.querySelectorAll(".block-title, h2, h3, h4"),
        );
        const sp = headings.find(
          (h) => /^spotlights$/i.test((h.textContent || "").trim()),
        );
        if (!sp) return [];
        let panel: Element | null = sp;
        for (let i = 0; i < 8; i++) {
          panel = panel?.parentElement ?? null;
          if (!panel) break;
          if (panel.querySelectorAll("article").length >= 3) break;
        }
        if (!panel) return [];
        const articles = Array.from(panel.querySelectorAll("article")).slice(0, 3);
        return articles.map((art) => {
          const a = art.querySelector("a[href]") as HTMLAnchorElement | null;
          const img = art.querySelector("img") as HTMLImageElement | null;
          const titleEl = art.querySelector("h2, h3, h4, .post-title, .entry-title");
          return {
            title: (titleEl?.textContent || "").trim(),
            href: a?.href ?? "",
            image: img?.currentSrc || img?.src || "",
          };
        });
      });
    }

    function fingerprint(items: Item[]) {
      return items.map((i) => i.href).join("|");
    }

    const all: Item[] = [];
    let prevFp = "";

    for (let p = 0; p < PAGES; p++) {
      if (p === 0) {
        await page.waitForTimeout(500);
      } else {
        // Click the right arrow inside the spotlights panel and wait for
        // the article hrefs to change.
        await page.evaluate(() => {
          const headings = Array.from(
            document.querySelectorAll(".block-title, h2, h3, h4"),
          );
          const sp = headings.find(
            (h) => /^spotlights$/i.test((h.textContent || "").trim()),
          );
          if (!sp) return;
          let panel: Element | null = sp;
          for (let i = 0; i < 8; i++) {
            panel = panel?.parentElement ?? null;
            if (!panel) break;
            if (panel.querySelectorAll("article").length >= 3) break;
          }
          if (!panel) return;
          const arrow = panel.querySelector(
            'a.tipi-arrow.tipi-arrow-r, a[data-dir="2"]',
          ) as HTMLElement | null;
          if (arrow) arrow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        const start = Date.now();
        let changed = false;
        while (Date.now() - start < 8000) {
          await page.waitForTimeout(300);
          const sample = await captureCurrentPage();
          if (sample.length === PER_PAGE && fingerprint(sample) !== prevFp) {
            changed = true;
            break;
          }
        }
        if (!changed) {
          throw new Error(`spotlights pagination did not advance to page ${p + 1}`);
        }
      }

      const items = await captureCurrentPage();
      if (items.length !== PER_PAGE) {
        throw new Error(`expected ${PER_PAGE} items on page ${p + 1}, got ${items.length}`);
      }
      for (const item of items) {
        if (!all.find((a) => a.href === item.href)) all.push(item);
      }
      prevFp = fingerprint(items);
    }

    if (all.length < TARGET_COUNT) {
      throw new Error(
        `expected ${TARGET_COUNT} unique spotlight items, got ${all.length}`,
      );
    }

    const data: SpotlightsData = {
      items: all.slice(0, TARGET_COUNT),
      scrapedAt: new Date().toISOString(),
    };
    writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2) + "\n");
    console.log(`wrote ${OUTPUT_PATH}`);
    console.log(`captured ${data.items.length} spotlight articles`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
