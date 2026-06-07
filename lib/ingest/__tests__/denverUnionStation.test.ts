import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDenverUnionStation } from "../connectors/denverUnionStation";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "denver-union-station-web",
  enabled: true,
  connector: "denverUnionStation",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://www.denverunionstation.com/events-sitemap.xml",
  defaultVenueSlug: "denver-union-station",
};

// CDATA-wrapped <loc> mirrors the real AIOSEO sitemap; the plain /about/ loc
// proves both forms parse and non-event URLs are filtered out.
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc><![CDATA[https://www.denverunionstation.com/events/future-fest/]]></loc></url>
  <url><loc><![CDATA[https://www.denverunionstation.com/events/past-gala/]]></loc></url>
  <url><loc><![CDATA[https://www.denverunionstation.com/events/weekly-market/]]></loc></url>
  <url><loc>https://www.denverunionstation.com/about/</loc></url>
</urlset>`;

function page(opts: {
  title: string;
  desc: string;
  img: string;
  body: string;
  category?: string;
}): string {
  const cat = opts.category
    ? `<a href="https://www.denverunionstation.com/?event_category=${opts.category}#x">cat</a>`
    : "";
  return `<html><head>
    <meta property="og:title" content="${opts.title} | Denver Union Station" />
    <meta property="og:description" content="${opts.desc}" />
    <meta property="og:image" content="${opts.img}" />
  </head><body>${cat}<h1>${opts.title}</h1><div class="content">${opts.body}</div></body></html>`;
}

const PAGES: Record<string, string> = {
  [source.url as string]: SITEMAP,
  "https://www.denverunionstation.com/events/future-fest/": page({
    title: "Future Fest",
    desc: "A big summer festival.",
    img: "https://img/future.jpg",
    body: "Join us August 10, 2026 for a day of fun.",
    category: "public-event",
  }),
  "https://www.denverunionstation.com/events/past-gala/": page({
    title: "Past Gala",
    desc: "Already happened.",
    img: "https://img/past.jpg",
    body: "Held March 3, 2026.",
  }),
  "https://www.denverunionstation.com/events/weekly-market/": page({
    title: "Weekly Market",
    desc: "Recurring market.",
    img: "https://img/market.jpg",
    body: "Dates: May 1, 2026, June 27, 2026, and July 4, 2026.",
    category: "family-kids",
  }),
};

describe("fetchDenverUnionStation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T18:00:00Z")); // Denver: 2026-06-04
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        const body = PAGES[u];
        return body === undefined
          ? { ok: false, status: 404, text: async () => "" }
          : { ok: true, status: 200, text: async () => body };
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps upcoming events, drops past one-offs, and ignores non-event URLs", async () => {
    const items = await fetchDenverUnionStation(source);
    const titles = items.map((i) => i.text.split("\n")[0]);
    expect(titles).toContain("Future Fest");
    expect(titles).toContain("Weekly Market");
    expect(titles).not.toContain("Past Gala"); // only past dates → skipped
    expect(items).toHaveLength(2);
  });

  it("sorts soonest-first and builds the blob from OG fields + dates", async () => {
    const items = await fetchDenverUnionStation(source);
    // Weekly Market's soonest upcoming date (Jun 27) precedes Future Fest (Aug 10).
    expect(items.map((i) => i.text.split("\n")[0])).toEqual(["Weekly Market", "Future Fest"]);

    const market = items[0];
    expect(market.text).toContain("Date: June 27, 2026"); // soonest upcoming, not the past May 1
    expect(market.text).toContain("Additional dates: July 4, 2026");
    expect(market.text).toContain("Category: Family Kids");
    expect(market.text).toContain("Venue: Denver Union Station");
    expect(market.venueName).toBe("Denver Union Station");
    expect(market.address).toContain("1701 Wynkoop");
    expect(market.imageUrl).toBe("https://img/market.jpg");
    expect(market.sourceUrl).toBe("https://www.denverunionstation.com/events/weekly-market/");
    // title suffix stripped, no internal sort key leaked
    expect(market).not.toHaveProperty("_sortKey");
  });

  it("respects maxItems (keeping the soonest)", async () => {
    const items = await fetchDenverUnionStation({ ...source, maxItems: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].text.split("\n")[0]).toBe("Weekly Market");
  });

  it("throws when url is missing", async () => {
    await expect(fetchDenverUnionStation({ ...source, url: undefined })).rejects.toThrow(/missing url/);
  });
});
