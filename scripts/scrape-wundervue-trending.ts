#!/usr/bin/env tsx
/**
 * Scrape the TRENDING panel content from wundervue.com and write it to
 * lib/data/wundervue-trending.json. Run on demand to refresh:
 *   npm run scrape:trending
 *
 * The live site's panel has Now / Week / Month tabs (data-r="1|2|3"). We
 * click each tab and capture the three article cards (rank, title, href,
 * image). All three tabs may return the same items on a given day — we
 * still record each list so later scrapes can pick up real differentiation.
 *
 * Fails fast if the panel or any tab is missing.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = "https://wundervue.com/";
const OUTPUT_PATH = resolve(__dirname, "..", "lib", "data", "wundervue-trending.json");

type Item = { rank: number; title: string; href: string; image: string };
type TrendingData = {
  now: Item[];
  week: Item[];
  month: Item[];
  scrapedAt: string;
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Block Klaviyo overlay so it can't block the click.
    await page.route("**/*", (r) => {
      if (/klaviyo/i.test(r.request().url())) return r.abort();
      return r.continue();
    });
    await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const trigger = await page.$("#trending-secondary");
    if (!trigger) throw new Error("trending trigger (#trending-secondary) not found");
    await trigger.click().catch(() => {});
    await page.waitForTimeout(500);

    const wrap = await page.$(".trending-inline-wrap");
    if (!wrap) throw new Error(".trending-inline-wrap not rendered after click");

    const tabs: Array<{ key: keyof Omit<TrendingData, "scrapedAt">; r: string }> = [
      { key: "now", r: "1" },
      { key: "week", r: "2" },
      { key: "month", r: "3" },
    ];

    async function captureItems() {
      return page.evaluate(() => {
        const wrap = document.querySelector(".trending-inline-wrap");
        if (!wrap) return [];
        const articles = Array.from(wrap.querySelectorAll("article"));
        return articles.map((art, i) => {
          const a = art.querySelector("a[href]") as HTMLAnchorElement | null;
          const img = art.querySelector("img") as HTMLImageElement | null;
          const titleEl = art.querySelector("h2, h3, h4, .post-title, .entry-title");
          return {
            rank: i + 1,
            title: (titleEl?.textContent || "").trim() || (a?.title || ""),
            href: a?.href ?? "",
            image: img?.currentSrc || img?.src || "",
          };
        });
      });
    }

    function fingerprint(items: { href: string }[]) {
      return items.map((i) => i.href).join("|");
    }

    const out: Partial<TrendingData> = {};
    let prevFingerprint = "";
    for (const [idx, { key, r }] of tabs.entries()) {
      const sel = `.trending-ops [data-r="${r}"]`;
      const tab = await page.$(sel);
      if (!tab) throw new Error(`trending tab data-r="${r}" (${key}) not found`);

      // Click via Playwright's regular click first; if the AJAX swap doesn't
      // happen, fall back to a real DOM click event dispatched from JS.
      await tab.click({ force: true }).catch(() => {});

      if (idx === 0) {
        await page.waitForTimeout(1000);
      } else {
        // Wait for the article list to differ from the previous tab.
        const start = Date.now();
        let changed = false;
        while (Date.now() - start < 8000) {
          await page.waitForTimeout(300);
          const sample = await captureItems();
          if (sample.length > 0 && fingerprint(sample) !== prevFingerprint) {
            changed = true;
            break;
          }
        }
        if (!changed) {
          // Fallback: simulate a JS-level click event in case the tipi/WP
          // theme's handler isn't wired to Playwright's synthetic click.
          await page.evaluate((selector) => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (!el) return;
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          }, sel);
          const start2 = Date.now();
          while (Date.now() - start2 < 8000) {
            await page.waitForTimeout(300);
            const sample = await captureItems();
            if (sample.length > 0 && fingerprint(sample) !== prevFingerprint) {
              changed = true;
              break;
            }
          }
        }
        if (!changed) {
          console.warn(
            `[scrape:trending] ${key} tab content did not change after ` +
              `clicking (kept items from previous tab); writing what was captured anyway.`,
          );
        }
      }

      const items = await captureItems();
      if (items.length === 0) {
        throw new Error(`no articles captured for ${key} tab`);
      }
      out[key] = items;
      prevFingerprint = fingerprint(items);
    }

    const data: TrendingData = {
      now: out.now!,
      week: out.week!,
      month: out.month!,
      scrapedAt: new Date().toISOString(),
    };
    writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2) + "\n");
    console.log(`wrote ${OUTPUT_PATH}`);
    console.log(`now: ${data.now.length} items, week: ${data.week.length}, month: ${data.month.length}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
