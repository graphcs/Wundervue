import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWpRestEvents } from "../connectors/wpRestEvents";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "denver-zoo-web",
  enabled: true,
  connector: "wpRestEvents",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://denverzoo.org/wp-json/wp/v2/atomic-event",
  defaultVenueSlug: "denver-zoo",
};

function ev(opts: {
  id: number;
  title: string;
  excerpt?: string;
  content?: string;
  image?: string;
}) {
  return {
    id: opts.id,
    link: `https://denverzoo.org/events/${opts.id}/`,
    title: { rendered: opts.title },
    excerpt: { rendered: `<p>${opts.excerpt ?? ""}</p>` },
    content: { rendered: `<div>${opts.content ?? ""}</div>` },
    _embedded: opts.image
      ? { "wp:featuredmedia": [{ source_url: opts.image }] }
      : undefined,
  };
}

const FEED = [
  // future, explicit current-year date — kept; entity in title decoded
  ev({
    id: 1,
    title: "Harley&#8217;s Birthday Party",
    excerpt: "A wildly fun birthday for Harley, our pot-bellied pig.",
    content: "<p>Join us on July 17, 2026 for cake!</p>",
    image: "https://denverzoo.org/wp-content/uploads/harley.jpg",
  }),
  // year-less date in the past part of the year — resolves to current year,
  // which is before today, so dropped
  ev({
    id: 2,
    title: "Día Del Niño",
    excerpt: "A family celebration.",
    content: "<p>Celebrate on May 3 with us.</p>",
  }),
  // year-less future date — resolved to the current year, kept
  ev({
    id: 3,
    title: "Member Night",
    excerpt: "Exclusive evening for members.",
    content: "<p>Doors open November 6 at 5pm.</p>",
  }),
  // no date anywhere — undated seasonal page, dropped
  ev({
    id: 4,
    title: "Winter at DZCA",
    excerpt: "Seasonal happenings all winter long.",
    content: "<p>Bundle up and visit.</p>",
  }),
  // recurring post carrying a STALE embedded year + a year-wrapping range —
  // substitute current year for the start, roll the end into next year, kept
  ev({
    id: 5,
    title: "Zoo Lights",
    excerpt: "Millions of lights.",
    content: "<p>Nightly November 24 – January 4, 2025.</p>",
  }),
  // ONGOING summer-long event: started before today but runs into September —
  // kept on the strength of its end date
  ev({
    id: 6,
    title: "130th Summer Celebration",
    excerpt: "A summer-long party.",
    content: "<p>Festivities run May 25 – September 7 all summer.</p>",
  }),
];

describe("fetchWpRestEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("builds blobs, decodes entities, attaches resolved dates and images", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => FEED })));

    const items = await fetchWpRestEvents(source);
    const byId = Object.fromEntries(items.map((i) => [i.sourceId, i]));

    // entity-decoded title (&#8217; → curly ’) + date parsed from body
    expect(byId["1"].text).toContain("Harley’s Birthday Party");
    expect(byId["1"].text).toContain("Date: July 17, 2026");
    expect(byId["1"].imageUrl).toBe("https://denverzoo.org/wp-content/uploads/harley.jpg");
    expect(byId["1"].sourceUrl).toBe("https://denverzoo.org/events/1/");

    // year-less future date resolved to the current year
    expect(byId["3"].text).toContain("Date: November 6, 2026");
    // stale embedded year (2025) replaced; range end wraps to next year
    expect(byId["5"].text).toContain("Date: November 24, 2026 – January 4, 2027");
    // ongoing range kept with both ends, same year
    expect(byId["6"].text).toContain("Date: May 25 – September 7, 2026");
  });

  it("keeps upcoming and ongoing events; drops past editions and undated pages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => FEED })));
    const items = await fetchWpRestEvents(source);
    const ids = items.map((i) => i.sourceId).sort();
    // 2 = May single (past), 4 = undated — dropped; 6 = May–Sep ongoing — kept
    expect(ids).toEqual(["1", "3", "5", "6"]);
  });

  it("requests per_page and the featured-media embed", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => FEED }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchWpRestEvents({ ...source, maxItems: 40 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://denverzoo.org/wp-json/wp/v2/atomic-event?per_page=40&_embed=wp:featuredmedia",
    );
  });

  it("throws when url is missing", async () => {
    await expect(fetchWpRestEvents({ ...source, url: undefined })).rejects.toThrow(
      /missing url/,
    );
  });
});
