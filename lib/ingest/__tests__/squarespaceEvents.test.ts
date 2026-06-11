import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSquarespaceEvents } from "../connectors/squarespaceEvents";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "larimer-square-web",
  enabled: true,
  connector: "squarespaceEvents",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://www.larimersquare.com/events",
  defaultVenueName: "Larimer Square",
  defaultVenueSlug: "larimer-square",
};

// Deterministic epoch-ms (Squarespace stores ms). June 7 2026, 18:00–20:00 UTC
// → America/Denver (UTC-6) = 12:00–2:00 PM.
const START = Date.UTC(2026, 5, 7, 18, 0, 0);
const END = Date.UTC(2026, 5, 7, 20, 0, 0);

const RESPONSE = {
  upcoming: [
    {
      id: "abc123",
      title: "Taylor Swift Drag Brunch at Osteria Marco",
      startDate: START,
      endDate: END,
      fullUrl: "/events/drag-brunch",
      assetUrl: "https://img/drag.jpg",
      excerpt: '<p class="x" style="white-space:pre-wrap;">Calling all Swifties &amp; friends.</p>',
      location: { addressTitle: "", addressLine1: "", addressLine2: "" },
    },
    {
      id: "def456",
      title: "LSQ Run Club",
      startDate: Date.UTC(2026, 5, 9, 23, 30, 0),
      fullUrl: "/events/run-club",
      assetUrl: "https://img/run.jpg",
      body: "<p>Hit the pavement with us.</p>",
      location: {},
    },
    { id: "no-date", title: "Untitled placeholder" }, // no startDate → skipped
  ],
  past: [{ id: "old", title: "Old event", startDate: START }],
};

function jsonResponse() {
  return { ok: true, status: 200, json: async () => RESPONSE };
}

describe("fetchSquarespaceEvents", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the upcoming feed, builds blobs, skips dateless items, ignores past", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse()));
    const items = await fetchSquarespaceEvents(source);
    const titles = items.map((i) => i.text.split("\n")[0]);
    expect(titles).toEqual(["Taylor Swift Drag Brunch at Osteria Marco", "LSQ Run Club"]);
    expect(titles).not.toContain("Old event"); // from `past`, not read
    expect(items).toHaveLength(2);
  });

  it("formats date/time in Denver TZ, strips HTML, and resolves fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse()));
    const items = await fetchSquarespaceEvents(source);
    const brunch = items[0];
    expect(brunch.text).toContain("Date: June 7, 2026");
    expect(brunch.text).toContain("Time: 12:00 PM – 2:00 PM");
    expect(brunch.text).toContain("Venue: Larimer Square");
    expect(brunch.text).toContain("Calling all Swifties & friends."); // HTML stripped + entity decoded
    expect(brunch.text).not.toMatch(/<p|style=/);
    expect(brunch.imageUrl).toBe("https://img/drag.jpg");
    expect(brunch.sourceUrl).toBe("https://www.larimersquare.com/events/drag-brunch");
    expect(brunch.venueName).toBe("Larimer Square");
  });

  it("appends ?format=json to the configured url", async () => {
    const f = vi.fn(async (_url: string) => jsonResponse());
    vi.stubGlobal("fetch", f);
    await fetchSquarespaceEvents(source);
    expect(f.mock.calls[0][0]).toBe("https://www.larimersquare.com/events?format=json");
  });

  it("respects maxItems", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse()));
    const items = await fetchSquarespaceEvents({ ...source, maxItems: 1 });
    expect(items).toHaveLength(1);
  });

  it("throws when url is missing", async () => {
    await expect(fetchSquarespaceEvents({ ...source, url: undefined })).rejects.toThrow(/missing url/);
  });
});
