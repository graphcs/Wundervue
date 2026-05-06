#!/usr/bin/env tsx
/**
 * Scrape header nav + social URLs from wundervue.com and write them to
 * lib/data/wundervue-nav.json. Run on demand to refresh:
 *   npm run scrape:nav
 *
 * Some top-level items (Best Of, Lifestyle, About) are dropdown triggers with
 * href="#" on the live site. For those we walk the dropdown's <ul class="sub-menu">
 * and use the first real child URL as the top-level href, while also keeping the
 * full child list in the JSON for later use.
 *
 * Fails fast if any expected nav label or social platform isn't found.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = "https://wundervue.com/";
const OUTPUT_PATH = resolve(__dirname, "..", "lib", "data", "wundervue-nav.json");

const EXPECTED_NAV_LABELS = ["Best Of", "Lifestyle", "Monthly Guides", "Spotlights", "About"] as const;
const EXPECTED_SOCIAL = {
  facebook: "facebook.com",
  instagram: "instagram.com",
  linkedin: "linkedin.com",
} as const;

type NavChild = { label: string; href: string };
type NavLink = { label: string; href: string; children: NavChild[] };
type SocialLinks = Record<keyof typeof EXPECTED_SOCIAL, string>;
type NavData = { nav: NavLink[]; social: SocialLinks; scrapedAt: string };

function isRealHref(href: string): boolean {
  if (!/^https?:\/\//.test(href)) return false;
  if (href.endsWith("#")) return false;
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const navTree = await page.evaluate(() => {
      const seen = new Set<Element>();
      const items: { label: string; href: string; children: { label: string; href: string }[] }[] = [];
      const anchors = document.querySelectorAll("nav a, header a");
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i] as HTMLAnchorElement;
        let cur: Element | null = a;
        while (cur && cur.tagName !== "LI") cur = cur.parentElement;
        if (!cur || seen.has(cur)) continue;
        const parentUl = cur.parentElement;
        if (!parentUl || parentUl.tagName !== "UL") continue;
        if (parentUl.closest("li")) continue;
        seen.add(cur);
        const children: { label: string; href: string }[] = [];
        const subAnchors = cur.querySelectorAll(":scope ul a[href]");
        for (let j = 0; j < subAnchors.length; j++) {
          const sa = subAnchors[j] as HTMLAnchorElement;
          const text = (sa.textContent || "").trim();
          if (text) children.push({ label: text, href: sa.href });
        }
        items.push({
          label: (a.textContent || "").trim(),
          href: a.href,
          children,
        });
      }
      return items;
    });

    const nav: NavLink[] = [];
    for (const label of EXPECTED_NAV_LABELS) {
      const match = navTree.find((n) => n.label.toLowerCase() === label.toLowerCase());
      if (!match) {
        throw new Error(`nav label not found on ${SITE_URL}: ${label}`);
      }
      let resolvedHref = match.href;
      if (!isRealHref(resolvedHref)) {
        const firstReal = match.children.find((c) => isRealHref(c.href));
        if (!firstReal) {
          throw new Error(
            `nav label "${label}" is a dropdown trigger but has no real child URL on ${SITE_URL}`,
          );
        }
        resolvedHref = firstReal.href;
      }
      nav.push({ label, href: resolvedHref, children: match.children });
    }

    const allAnchors = await page.$$eval("a[href]", (els) =>
      els.map((a) => (a as HTMLAnchorElement).href),
    );

    const social = {} as SocialLinks;
    for (const [platform, domain] of Object.entries(EXPECTED_SOCIAL) as [
      keyof typeof EXPECTED_SOCIAL,
      string,
    ][]) {
      const match = allAnchors.find((href) => href.includes(domain));
      if (!match) {
        throw new Error(`social link not found on ${SITE_URL}: ${platform} (looked for ${domain})`);
      }
      social[platform] = match;
    }

    const data: NavData = { nav, social, scrapedAt: new Date().toISOString() };
    writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2) + "\n");
    console.log(`wrote ${OUTPUT_PATH}`);
    console.log(JSON.stringify(data, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
