import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAquariumCalendar } from "../connectors/aquariumCalendar";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "downtown-aquarium-web",
  enabled: true,
  connector: "aquariumCalendar",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://www.aquariumrestaurants.com/downtownaquariumdenver/calendar.asp",
  defaultVenueSlug: "downtown-aquarium",
};

// Mirrors the real page: month <h2> + a sibling <ul> whose <li>s lead with the
// day. Includes a noise program, a past month, a multi-day range, an undated
// recurring promo, and an é (to prove the win-1252 path round-trips text).
const HTML = `<html><body>
  <h2>May 2026</h2>
  <ul>
    <li><b>9</b> Binturong Day: Meet our binturong.</li>
  </ul>
  <h2>June 2026</h2>
  <ul>
    <li>Friday Family Nights: $2.99 Kids Meal after 6pm.</li>
    <li><b>12</b> Wild Dreams Overnight: Register here.</li>
    <li><b>16</b> World Sea Turtle Day: Celebrate these reptiles with a fancy entrée.</li>
    <li><b>21</b> Father's Day: Bring dad to dinner under the sea!</li>
  </ul>
  <h2>October 2026</h2>
  <ul>
    <li><b>24</b> – 25, 31 Halloween Kids Fest: Costumes and candy.</li>
  </ul>
</body></html>`;

// Win-1252 byte for the handful of "smart" code points the real page uses
// (the 0x80–0x9F range that isn't latin1). Everything else ≤ 0xFF is identity.
const W1252: Record<number, number> = {
  0x2013: 0x96, // en dash
  0x2014: 0x97, // em dash
  0x2019: 0x92, // right single quote
  0x201c: 0x93,
  0x201d: 0x94,
};
function win1252Bytes(s: string): Uint8Array {
  return Uint8Array.from([...s].map((ch) => {
    const cp = ch.codePointAt(0)!;
    return W1252[cp] ?? (cp <= 0xff ? cp : 0x3f);
  }));
}

function htmlResponse(body: string) {
  // Faithfully encode the fixture as windows-1252 bytes (en dash → 0x96,
  // é → 0xE9), mirroring the real page so the connector's decode path is tested.
  return { ok: true, arrayBuffer: async () => win1252Bytes(body).buffer };
}

describe("fetchAquariumCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps future special events with month-derived dates, drops noise/past/undated", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(HTML)));

    const items = await fetchAquariumCalendar(source);
    const titles = items.map((i) => i.text.split("\n")[0]);

    // Kept: World Sea Turtle Day (Jun 16), Father's Day (Jun 21), Halloween Kids Fest (Oct 24)
    expect(titles).toContain("World Sea Turtle Day: Celebrate these reptiles with a fancy entrée.");
    expect(titles.some((t) => t.startsWith("Father's Day"))).toBe(true);
    // multi-day range fragment stripped from the title
    expect(titles).toContain("Halloween Kids Fest: Costumes and candy.");

    // Dropped: Binturong (past month), Wild Dreams Overnight (noise),
    // Friday Family Nights (undated recurring promo)
    expect(titles.some((t) => t.includes("Binturong"))).toBe(false);
    expect(titles.some((t) => t.includes("Wild Dreams"))).toBe(false);
    expect(titles.some((t) => t.includes("Family Nights"))).toBe(false);

    expect(items).toHaveLength(3);
  });

  it("attaches the correct month/year date and venue to each item", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(HTML)));

    const items = await fetchAquariumCalendar(source);
    const turtle = items.find((i) => i.text.startsWith("World Sea Turtle Day"))!;

    expect(turtle.text).toContain("Date: June 16, 2026");
    expect(turtle.text).toContain("Venue: Downtown Aquarium, Denver");
    expect(turtle.venueName).toBe("Downtown Aquarium");
    expect(turtle.sourceUrl).toBe(source.url);
  });

  it("respects maxItems", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(HTML)));
    const items = await fetchAquariumCalendar({ ...source, maxItems: 1 });
    expect(items).toHaveLength(1);
  });

  it("throws when url is missing", async () => {
    await expect(
      fetchAquariumCalendar({ ...source, url: undefined }),
    ).rejects.toThrow(/missing url/);
  });
});
