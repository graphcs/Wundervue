import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEventRssFeed } from "../connectors/eventRssFeed";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "denver-arts-venues-web",
  enabled: true,
  connector: "eventRssFeed",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://www.artsandvenuesdenver.com/events/rss",
};

// ev:startdate is UTC; America/Denver is UTC-6 in June.
const RSS = `<?xml version="1.0"?><rss xmlns:ev="http://purl.org/rss/1.0/modules/event/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
  <item>
    <title>Jimmy Eat World</title>
    <link>https://www.artsandvenuesdenver.com/events/detail/jimmy-eat-world</link>
    <guid>g-jew</guid>
    <description>&lt;p&gt;Emo legends&amp;rsquo; return.&lt;/p&gt;</description>
    <ev:location>Red Rocks Amphitheatre</ev:location>
    <ev:type>Concert</ev:type>
    <ev:startdate>2026-06-10T01:00:00Z</ev:startdate>
    <ev:enddate>2026-06-10T01:00:00Z</ev:enddate>
  </item>
  <item>
    <title>NACE 2026 Annual Meeting</title>
    <link>https://denverconvention.com/events/details/nace-2026</link>
    <guid>g-nace</guid>
    <description></description>
    <ev:location>Colorado Convention Center</ev:location>
    <ev:type>General</ev:type>
    <ev:startdate>2026-06-15T06:00:00Z</ev:startdate>
    <ev:enddate>2026-06-15T06:00:00Z</ev:enddate>
  </item>
  <item>
    <title>Harry Potter and the Cursed Child</title>
    <link>https://www.artsandvenuesdenver.com/events/detail/harry-potter</link>
    <guid>g-hp</guid>
    <description>Broadway spectacular.</description>
    <ev:location>Buell Theatre</ev:location>
    <ev:startdate>2026-06-20T01:00:00Z</ev:startdate>
    <ev:enddate>2026-06-25T01:00:00Z</ev:enddate>
  </item>
  <item>
    <title>Old Show</title>
    <link>/events/detail/old</link>
    <guid>g-old</guid>
    <ev:location>McNichols Building</ev:location>
    <ev:startdate>2026-06-01T01:00:00Z</ev:startdate>
    <ev:enddate>2026-06-01T01:00:00Z</ev:enddate>
  </item>
  <item>
    <title>Jimmy Eat World</title>
    <link>https://www.artsandvenuesdenver.com/events/detail/jimmy-eat-world</link>
    <guid>g-jew</guid>
    <ev:location>Red Rocks Amphitheatre</ev:location>
    <ev:startdate>2026-06-10T01:00:00Z</ev:startdate>
  </item>
</channel></rss>`;

describe("fetchEventRssFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => RSS })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("parses ev: items, drops past, dedupes guid, sorts soonest-first", async () => {
    const items = await fetchEventRssFeed(source);
    expect(items.map((i) => i.text.split("\n")[0])).toEqual([
      "Jimmy Eat World",
      "NACE 2026 Annual Meeting",
      "Harry Potter and the Cursed Child",
    ]);
  });

  it("localizes UTC dates to Denver and builds the blob", async () => {
    const items = await fetchEventRssFeed(source);
    const jew = items[0];
    expect(jew.text).toContain("Date: June 9, 2026"); // T01:00Z localizes back to Jun 9, not Jun 10
    expect(jew.text).toContain("Time: 7:00 PM");
    expect(jew.text).toContain("Category: Concert");
    expect(jew.text).toContain("Venue: Red Rocks Amphitheatre");
    expect(jew.text).toContain("Emo legends’ return."); // double-encoded HTML decoded + stripped
    expect(jew.text).not.toMatch(/<p|&lt;|&amp;/);
    expect(jew.venueName).toBe("Red Rocks Amphitheatre");
    expect(jew.sourceUrl).toBe("https://www.artsandvenuesdenver.com/events/detail/jimmy-eat-world");
    expect(jew.imageUrl).toBeUndefined(); // pipeline pulls og:image from the detail page
  });

  it("omits time for all-day (midnight) events and notes multi-day ranges", async () => {
    const items = await fetchEventRssFeed(source);
    const nace = items[1];
    expect(nace.text).toContain("Date: June 15, 2026");
    expect(nace.text).not.toContain("Time:");
    const hp = items[2];
    expect(hp.text).toContain("Date: June 19, 2026"); // T01:00Z → Jun 19 local
    expect(hp.text).toContain("Through: June 24, 2026");
  });

  it("respects maxItems", async () => {
    const items = await fetchEventRssFeed({ ...source, maxItems: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].text.split("\n")[0]).toBe("Jimmy Eat World");
  });

  it("throws when url is missing", async () => {
    await expect(fetchEventRssFeed({ ...source, url: undefined })).rejects.toThrow(/missing url/);
  });
});
