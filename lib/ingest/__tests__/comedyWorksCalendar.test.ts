import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchComedyWorksCalendar } from "../connectors/comedyWorksCalendar";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "comedy-works-web",
  enabled: true,
  connector: "comedyWorksCalendar",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://comedyworks.com/shows/calendar",
  monthsAhead: 0, // single month in tests
  defaultCategory: "Comedy",
};

// One calendar cell per show, mirroring the real grid: a future cell with two
// events (Downtown + South), a past cell (filtered out), and a noevent cell.
const CALENDAR = `<table><tbody><tr>
  <td class="calendar-thismonth calendar-noevent" data-date="2026-06-03"><div class="calendar-daynum">3</div></td>
  <td class="calendar-thismonth calendar-hasevent" data-date="2026-06-02">
    <ul class="calendar-events">
      <li class="calendar-event">
        <div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/past-act">Past Act</a></h3>
          <p class="calendar-event-location downtown">Comedy Works Downtown</p>
        </div>
      </li>
    </ul>
  </td>
  <td class="calendar-thismonth calendar-hasevent" data-date="2026-06-05">
    <ul class="calendar-events">
      <li class="calendar-event">
        <div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/steven-ho">Steven Ho</a></h3>
          <p class="calendar-event-location downtown">Comedy Works Downtown</p>
        </div>
      </li>
      <li class="calendar-event">
        <div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/jeremiah-watkins">Jeremiah Watkins</a></h3>
          <p class="calendar-event-location south">Comedy Works South</p>
        </div>
      </li>
    </ul>
  </td>
  <td class="calendar-thismonth calendar-hasevent" data-date="2026-06-06">
    <ul class="calendar-events">
      <li class="calendar-event">
        <div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/steven-ho">Steven Ho</a></h3>
          <p class="calendar-event-location downtown">Comedy Works Downtown</p>
        </div>
      </li>
    </ul>
  </td>
</tr></tbody></table>`;

// Steven Ho show page: a run with two future dates (Jun 5, Jun 6) each with two
// showtimes, plus venue/address, prices and a bio. The connector should prefer
// these showtime dates over the calendar's.
const STEVEN_HO = `<html><body>
  <div class="comedian-intro">
    <img class="comedian_photo" alt="Steven Ho" src="/rails/active_storage/representations/steven.jpg" />
    <h1>Steven Ho</h1>
  </div>
  <div class="ticket-location"><div class="club">
    <p class="club-title club-downtown">Comedy Works Downtown</p>
    <div class="club-meta">
      <p class="club-address">1226 15th Street Denver, CO 80202 <a class="map-link" href="https://maps.example">map</a></p>
      <p class="club-telephone">303-595-3637</p>
    </div>
  </div></div>
  <ul class="show-times">
    <li><div class="show-info"><p class="show-day">Friday, Jun 05 2026  7:00PM</p></div></li>
    <li><div class="show-info"><p class="show-day">Friday, Jun 05 2026  9:15PM</p></div></li>
    <li><div class="show-info"><p class="show-day">Saturday, Jun 06 2026  6:30PM</p></div></li>
    <li><span class="product-price">$35.00</span><span class="product-price">$45.00</span></li>
  </ul>
  <div class="comedian-desc">
    <h1>Steven Ho</h1>
    <p>Steven Ho is a former ER Technician turned stand-up comedian.</p>
  </div>
</body></html>`;

// South-club show page with a single future showtime.
const JEREMIAH = `<html><body>
  <div class="comedian-intro">
    <img class="comedian_photo" alt="Jeremiah Watkins" src="/rails/active_storage/representations/jeremiah.jpg" />
    <h1>Jeremiah Watkins</h1>
  </div>
  <div class="ticket-location"><div class="club">
    <p class="club-title club-south">Comedy Works South</p>
    <div class="club-meta">
      <p class="club-address">5345 Landmark Place Greenwood Village, CO 80111 <a class="map-link" href="https://maps.example">map</a></p>
    </div>
  </div></div>
  <ul class="show-times">
    <li><div class="show-info"><p class="show-day">Friday, Jun 05 2026  7:30PM</p></div></li>
    <li><span class="product-price">$30.00</span></li>
  </ul>
  <div class="comedian-desc"><h1>Jeremiah Watkins</h1><p>A high-energy stand-up.</p></div>
</body></html>`;

type FakeResponse = { ok: boolean; status?: number; text: () => Promise<string> };
function textResponse(body: string): FakeResponse {
  return { ok: true, text: async () => body };
}

// Route the mocked fetch by URL: calendar page vs each show page.
function routedFetch() {
  return vi.fn(async (input: string) => {
    const url = String(input);
    if (url.includes("/shows/calendar")) return textResponse(CALENDAR);
    if (url.includes("/comedians/steven-ho")) return textResponse(STEVEN_HO);
    if (url.includes("/comedians/jeremiah-watkins")) return textResponse(JEREMIAH);
    if (url.includes("/comedians/past-act")) return textResponse(STEVEN_HO);
    throw new Error(`unexpected url ${url}`);
  });
}

describe("fetchComedyWorksCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("emits one item per show-date from the show page's showtimes", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const items = await fetchComedyWorksCalendar(source);
    const ids = items.map((i) => i.sourceId);

    // Steven Ho: Jun 5 + Jun 6 (from show page). Jeremiah: Jun 5.
    expect(ids).toContain("comedy-works-web:steven-ho:2026-06-05");
    expect(ids).toContain("comedy-works-web:steven-ho:2026-06-06");
    expect(ids).toContain("comedy-works-web:jeremiah-watkins:2026-06-05");
    expect(items).toHaveLength(3);
  });

  it("builds a blob with date, showtimes, venue, address, price and description", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const items = await fetchComedyWorksCalendar(source);
    const fri = items.find((i) => i.sourceId === "comedy-works-web:steven-ho:2026-06-05")!;

    expect(fri.text).toContain("Steven Ho");
    expect(fri.text).toContain("Date: 2026-06-05");
    expect(fri.text).toContain("Showtimes: 7:00 PM, 9:15 PM");
    expect(fri.text).toContain("Venue: Comedy Works Downtown");
    expect(fri.text).toContain("Address: 1226 15th Street Denver, CO 80202");
    expect(fri.text).toContain("Tickets: $35 - $45");
    expect(fri.text).toContain("About: Steven Ho is a former ER Technician");
    expect(fri.venueName).toBe("Comedy Works Downtown");
    expect(fri.address).toBe("1226 15th Street Denver, CO 80202");
    expect(fri.imageUrl).toBe("https://comedyworks.com/rails/active_storage/representations/steven.jpg");
    expect(fri.sourceUrl).toBe("https://comedyworks.com/comedians/steven-ho");
  });

  it("pins the South club to its own venue", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const items = await fetchComedyWorksCalendar(source);
    const south = items.find((i) => i.sourceId.startsWith("comedy-works-web:jeremiah-watkins"))!;
    expect(south.venueName).toBe("Comedy Works South");
    expect(south.text).toContain("Greenwood Village");
  });

  it("drops past show-dates from both the calendar and the show page", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const items = await fetchComedyWorksCalendar(source);
    // past-act sat on Jun 2 (before today Jun 4) — never discovered.
    expect(items.some((i) => i.sourceId.includes("past-act"))).toBe(false);
  });

  it("respects maxItems, keeping the soonest", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const items = await fetchComedyWorksCalendar({ ...source, maxItems: 2 });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.sourceId.slice(i.sourceId.lastIndexOf(":") + 1))).toEqual([
      "2026-06-05",
      "2026-06-05",
    ]);
  });

  it("stops fetching show pages once maxItems is locked in (soonest-first)", async () => {
    // Three shows on distinct future dates; each detail has a single showtime.
    const cal = `<table><tbody><tr>
      <td class="calendar-hasevent" data-date="2026-06-19">
        <ul class="calendar-events"><li class="calendar-event"><div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/show-c">Show C</a></h3>
          <p class="calendar-event-location downtown">Comedy Works Downtown</p></div></li></ul>
      </td>
      <td class="calendar-hasevent" data-date="2026-06-05">
        <ul class="calendar-events"><li class="calendar-event"><div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/show-a">Show A</a></h3>
          <p class="calendar-event-location downtown">Comedy Works Downtown</p></div></li></ul>
      </td>
      <td class="calendar-hasevent" data-date="2026-06-12">
        <ul class="calendar-events"><li class="calendar-event"><div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/show-b">Show B</a></h3>
          <p class="calendar-event-location downtown">Comedy Works Downtown</p></div></li></ul>
      </td>
    </tr></tbody></table>`;
    const detail = (date: string) =>
      `<html><body><div class="comedian-desc"><h1>x</h1><p>x</p></div>
        <ul class="show-times"><li><div class="show-info"><p class="show-day">Friday, ${date} 2026  7:00PM</p></div></li></ul>
      </body></html>`;
    const fetched: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes("/shows/calendar")) return textResponse(cal);
        fetched.push(url.split("/comedians/")[1]);
        if (url.includes("show-a")) return textResponse(detail("Jun 05"));
        if (url.includes("show-b")) return textResponse(detail("Jun 12"));
        return textResponse(detail("Jun 19"));
      }),
    );
    const items = await fetchComedyWorksCalendar({ ...source, maxItems: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("comedy-works-web:show-a:2026-06-05");
    // Only the soonest show's page was fetched; B and C were skipped.
    expect(fetched).toEqual(["show-a"]);
  });

  it("falls back to calendar dates when a show page has no parseable showtimes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes("/shows/calendar")) return textResponse(CALENDAR);
        // Bare page: no show-times list.
        return textResponse("<html><body><div class='club'><p class='club-title'>Comedy Works Downtown</p></div></body></html>");
      }),
    );
    const items = await fetchComedyWorksCalendar(source);
    // Steven Ho was on the calendar for Jun 5 and Jun 6.
    expect(items.some((i) => i.sourceId === "comedy-works-web:steven-ho:2026-06-05")).toBe(true);
    expect(items.some((i) => i.sourceId === "comedy-works-web:steven-ho:2026-06-06")).toBe(true);
  });

  it("filters to the configured club (downtown)", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const items = await fetchComedyWorksCalendar({ ...source, comedyWorksClub: "downtown" });
    expect(items.every((i) => i.sourceId.includes(":steven-ho:"))).toBe(true);
    expect(items.some((i) => i.sourceId.includes("jeremiah-watkins"))).toBe(false);
    expect(items).toHaveLength(2); // Steven Ho Jun 5 + Jun 6
  });

  it("filters to the configured club (south)", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const items = await fetchComedyWorksCalendar({ ...source, comedyWorksClub: "south" });
    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("comedy-works-web:jeremiah-watkins:2026-06-05");
  });

  it("excludes external concerts (neither downtown nor south) under a club filter", async () => {
    const cal = `<table><tbody><tr>
      <td class="calendar-hasevent" data-date="2026-06-05">
        <ul class="calendar-events">
          <li class="calendar-event"><div class="calendar-event-content">
            <h3 class="calendar-event-title"><a href="/comedians/steven-ho">Steven Ho</a></h3>
            <p class="calendar-event-location downtown">Comedy Works Downtown</p></div></li>
          <li class="calendar-event"><div class="calendar-event-content">
            <h3 class="calendar-event-title"><a href="/comedians/alok-tour">ALOK Tour</a></h3>
            <p class="calendar-event-location concerts">Paramount Theatre</p></div></li>
        </ul>
      </td>
    </tr></tbody></table>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes("/shows/calendar")) return textResponse(cal);
        if (url.includes("/comedians/steven-ho")) return textResponse(STEVEN_HO);
        throw new Error(`should not fetch ${url}`); // ALOK detail must never be fetched
      }),
    );
    const items = await fetchComedyWorksCalendar({ ...source, comedyWorksClub: "downtown" });
    expect(items.some((i) => i.sourceId.includes("alok-tour"))).toBe(false);
    expect(items.every((i) => i.sourceId.includes("steven-ho"))).toBe(true);
  });

  it("does not leak an empty venue name when location is blank and the show page fails", async () => {
    const cal = `<table><tbody><tr>
      <td class="calendar-hasevent" data-date="2026-06-05">
        <ul class="calendar-events"><li class="calendar-event"><div class="calendar-event-content">
          <h3 class="calendar-event-title"><a href="/comedians/mystery">Mystery Show</a></h3>
          <p class="calendar-event-location"></p></div></li></ul>
      </td>
    </tr></tbody></table>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes("/shows/calendar")) return textResponse(cal);
        const fail: FakeResponse = { ok: false, status: 404, text: async () => "" };
        return fail; // detail 404 (non-retryable)
      }),
    );
    // No club filter so the untagged event is collected; blank location + failed
    // detail must yield venueName undefined, never "".
    const items = await fetchComedyWorksCalendar({ ...source });
    expect(items).toHaveLength(1);
    expect(items[0].venueName).toBeUndefined();
    expect(items[0].text).not.toContain("Venue:");
  });

  it("throws when url is missing", async () => {
    await expect(
      fetchComedyWorksCalendar({ ...source, url: undefined }),
    ).rejects.toThrow(/missing url/);
  });
});
