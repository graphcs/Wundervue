import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTribeEvents } from "../connectors/tribeEvents";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "dairy-block-web",
  enabled: true,
  connector: "tribeEvents",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://dairyblock.com/events/",
  defaultVenueSlug: "dairy-block",
};

const jazz = {
  id: 1,
  url: "https://dairyblock.com/events/thursday-jazz-at-seven-grand/2026-07-02/",
  title: "Thursday Jazz at Seven Grand",
  description: "<p>Enjoy delicious drinks &amp; amazing music! Live jazz sets.</p>",
  image: "https://dairyblock.com/wp-content/uploads/seven-grand.jpg",
  all_day: false,
  start_date: "2026-07-02 20:30:00",
  end_date: "2026-07-02 23:30:00",
  cost: "Free",
  categories: [{ name: "Food + Drink" }, { name: "Music" }],
  venue: { venue: "Seven Grand", address: "1855 Blake St #160", city: "Denver", state: "CO" },
};
const whiskey = {
  id: 2,
  url: "https://dairyblock.com/events/seven-grand-whiskey-society-5/2026-07-01/",
  title: "Seven Grand Whiskey Society",
  description: "",
  image: { url: "https://dairyblock.com/wp-content/uploads/bar.jpg" },
  all_day: true,
  start_date: "2026-07-01 00:00:00",
  end_date: "2026-07-01 00:00:00",
  categories: [],
  venue: [] as unknown, // Tribe returns [] when no venue
};
const trivia = {
  id: 3,
  url: "https://dairyblock.com/events/geeks-who-drink-trivia/2026-07-02/",
  title: "Geeks Who Drink | Trivia",
  start_date: "2026-07-02 19:00:00",
  all_day: false,
  image: "/wp-content/uploads/trivia.png", // site-relative → must be absolutized
  categories: [{ name: "Food &amp; Dining" }], // entity → must be decoded
};

const PAGE1 = {
  events: [jazz, whiskey],
  next_rest_url: "https://dairyblock.com/wp-json/tribe/events/v1/events?page=2&per_page=50",
};
const PAGE2 = { events: [trivia] }; // no next_rest_url → end

function routeFetch() {
  return vi.fn(async (u: string) => ({
    ok: true,
    status: 200,
    json: async () => (u.includes("page=2") ? PAGE2 : PAGE1),
  }));
}

describe("fetchTribeEvents", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the Tribe REST API and follows pagination", async () => {
    vi.stubGlobal("fetch", routeFetch());
    const items = await fetchTribeEvents(source);
    expect(items.map((i) => i.text.split("\n")[0])).toEqual([
      "Thursday Jazz at Seven Grand",
      "Seven Grand Whiskey Society",
      "Geeks Who Drink | Trivia",
    ]);
  });

  it("formats local date/time without UTC shift and assembles the blob", async () => {
    vi.stubGlobal("fetch", routeFetch());
    const items = await fetchTribeEvents(source);
    const j = items[0];
    expect(j.text).toContain("Date: July 2, 2026"); // not Jul 1/3 from a TZ round-trip
    expect(j.text).toContain("Time: 8:30 PM – 11:30 PM");
    expect(j.text).toContain("Category: Food + Drink, Music");
    expect(j.text).toContain("Cost: Free");
    expect(j.text).toContain("Venue: Seven Grand, 1855 Blake St #160, Denver, CO");
    expect(j.text).toContain("Live jazz sets."); // HTML stripped, entity decoded (&)
    expect(j.imageUrl).toBe("https://dairyblock.com/wp-content/uploads/seven-grand.jpg");
    expect(j.sourceUrl).toBe(jazz.url);
    expect(j.venueName).toBe("Seven Grand");
    expect(j.address).toContain("1855 Blake St #160");
  });

  it("omits time for all-day events, reads image objects, handles empty venue", async () => {
    vi.stubGlobal("fetch", routeFetch());
    const items = await fetchTribeEvents(source);
    const w = items[1];
    expect(w.text).toContain("Date: July 1, 2026");
    expect(w.text).not.toContain("Time:");
    expect(w.text).not.toContain("Venue:");
    expect(w.venueName).toBeUndefined();
    expect(w.imageUrl).toBe("https://dairyblock.com/wp-content/uploads/bar.jpg");
  });

  it("absolutizes site-relative images and decodes category entities", async () => {
    vi.stubGlobal("fetch", routeFetch());
    const items = await fetchTribeEvents(source);
    const t = items.find((i) => i.text.startsWith("Geeks Who Drink"))!;
    expect(t.imageUrl).toBe("https://dairyblock.com/wp-content/uploads/trivia.png");
    expect(t.text).toContain("Category: Food & Dining");
    expect(t.text).not.toContain("&amp;");
  });

  it("respects maxItems and stops paginating early", async () => {
    const f = routeFetch();
    vi.stubGlobal("fetch", f);
    const items = await fetchTribeEvents({ ...source, maxItems: 1 });
    expect(items).toHaveLength(1);
    expect(f.mock.calls).toHaveLength(1); // never fetched page 2
  });

  it("keeps up to 3 occurrences of a recurring program (soonest), not more", async () => {
    const occ = (d: string) => ({
      id: `tt-${d}`,
      url: `https://dairyblock.com/events/tequila-tuesday/2026-07-${d}/`,
      title: "Tequila Tuesday",
      start_date: `2026-07-${d} 19:00:00`,
      all_day: false,
    });
    const resp = { events: [occ("07"), occ("14"), occ("21"), occ("28")] }; // 4 weekly
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => resp })));
    const items = await fetchTribeEvents(source);
    const tt = items.filter((i) => i.text.startsWith("Tequila Tuesday"));
    expect(tt).toHaveLength(3); // capped
    const dates = tt.map((i) => i.text.match(/Date: ([^\n]+)/)![1]);
    expect(dates).toEqual(["July 7, 2026", "July 14, 2026", "July 21, 2026"]); // soonest 3
  });

  it("throws when url is missing", async () => {
    await expect(fetchTribeEvents({ ...source, url: undefined })).rejects.toThrow(/missing url/);
  });
});
