import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "../types";
import { fetchEventive } from "../connectors/eventive";
import { fetchJsonLdEvents } from "../connectors/jsonLdEvents";
import { fetchKseTicketmaster } from "../connectors/kseTicketmaster";
import { fetchNbaSchedule } from "../connectors/nbaSchedule";
import { fetchNhlSchedule } from "../connectors/nhlSchedule";
import { fetchVenuePilot } from "../connectors/venuePilot";
import { fetchWixEvents } from "../connectors/wixEvents";

// Smoke-test each connector's parser by mocking global.fetch with a small
// canned response and asserting the public RawItem shape. These tests cover
// the happy-path schema mapping — date filtering, image picking, text
// composition — without exercising the live network. Schema-drift in any of
// these upstream APIs will surface here as a failed assertion before
// landing in production.

afterEach(() => {
  vi.restoreAllMocks();
});

function mockJsonOnce(payload: unknown, opts: { ok?: boolean; status?: number } = {}) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response);
}

function mockTextOnce(html: string) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: async () => html,
  } as unknown as Response);
}

// One year in the future — keeps fixtures stable regardless of when tests run.
const FUTURE_ISO = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE_DATE = FUTURE_ISO.slice(0, 10);

describe("fetchJsonLdEvents", () => {
  const source: SourceConfig = {
    id: "ticketmaster-denver",
    connector: "jsonLdEvents",
    cadence: "weekly",
    enabled: true,
    sourceLabel: "Ticketmaster",
    url: "https://www.ticketmaster.com/discover/concerts/denver",
  };

  it("extracts events from a JSON-LD script block", async () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "item": {
              "@type": "MusicEvent",
              "name": "Test Concert",
              "startDate": "${FUTURE_ISO}",
              "url": "https://www.ticketmaster.com/event/abc",
              "image": "https://img.example.com/concert.jpg",
              "location": {
                "@type": "Place",
                "name": "Ball Arena",
                "address": {
                  "streetAddress": "1000 Chopper Cir",
                  "addressLocality": "Denver",
                  "addressRegion": "CO"
                }
              },
              "offers": { "price": "45", "priceCurrency": "USD" }
            }
          }
        ]
      }
      </script>
      </head><body></body></html>
    `;
    mockTextOnce(html);
    const items = await fetchJsonLdEvents(source);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.sourceUrl).toBe("https://www.ticketmaster.com/event/abc");
    expect(item.imageUrl).toBe("https://img.example.com/concert.jpg");
    expect(item.venueName).toBe("Ball Arena");
    expect(item.address).toBe("1000 Chopper Cir, Denver, CO");
    expect(item.text).toContain("Title: Test Concert");
    expect(item.text).toContain("Price: From $45");
  });

  it("deduplicates events that share a canonical url", async () => {
    const html = `
      <script type="application/ld+json">
      [
        { "@type": "Event", "name": "A", "url": "https://x.com/1", "startDate": "${FUTURE_ISO}" },
        { "@type": "Event", "name": "A", "url": "https://x.com/1", "startDate": "${FUTURE_ISO}" }
      ]
      </script>
    `;
    mockTextOnce(html);
    const items = await fetchJsonLdEvents(source);
    expect(items).toHaveLength(1);
  });

  it("skips non-Event-typed nodes when walking @graph", async () => {
    const html = `
      <script type="application/ld+json">
      { "@graph": [
        { "@type": "WebPage", "name": "Not an event" },
        { "@type": "TheaterEvent", "name": "A Play", "startDate": "${FUTURE_ISO}" }
      ] }
      </script>
    `;
    mockTextOnce(html);
    const items = await fetchJsonLdEvents(source);
    expect(items).toHaveLength(1);
    expect(items[0].text).toContain("A Play");
  });
});

describe("fetchEventive", () => {
  const source: SourceConfig = {
    id: "denverfilm",
    connector: "eventive",
    cadence: "weekly",
    enabled: true,
    sourceLabel: "Website",
    eventiveTenant: "denverfilm",
    eventiveApiKey: "public-key",
    eventiveEventBucketId: "bucket-1",
  };

  it("maps an upcoming event with film metadata to a RawItem", async () => {
    mockJsonOnce({
      events: [
        {
          id: "evt-1",
          name: "Indie Premiere",
          start_time: FUTURE_ISO,
          venue: { name: "Sie FilmCenter", address: "2510 E Colfax Ave, Denver, CO" },
          films: [
            {
              id: "film-1",
              short_description: "A <em>compelling</em> story.",
              still_image: "https://cdn.eventive.org/still.jpg",
            },
          ],
        },
      ],
    });
    const items = await fetchEventive(source);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.sourceUrl).toBe("https://denverfilm.eventive.org/schedule/evt-1");
    expect(item.imageUrl).toBe("https://cdn.eventive.org/still.jpg");
    expect(item.venueName).toBe("Sie FilmCenter");
    expect(item.text).toContain("Description: A compelling story.");
  });

  it("filters out past events", async () => {
    mockJsonOnce({
      events: [
        { id: "old", name: "Past Show", start_time: "2020-01-01T00:00:00Z" },
        { id: "new", name: "Future Show", start_time: FUTURE_ISO },
      ],
    });
    const items = await fetchEventive(source);
    expect(items.map((i) => i.sourceId)).toEqual(["denverfilm:new"]);
  });

  it("falls back to cover_image with size params when still_image is missing", async () => {
    mockJsonOnce({
      events: [
        {
          id: "evt-2",
          name: "Cover Only",
          start_time: FUTURE_ISO,
          films: [{ cover_image: "https://cdn.eventive.org/cover.jpg" }],
        },
      ],
    });
    const items = await fetchEventive(source);
    expect(items[0].imageUrl).toBe(
      "https://cdn.eventive.org/cover.jpg?w=1200&h=800&fit=crop",
    );
  });
});

describe("fetchKseTicketmaster", () => {
  const source: SourceConfig = {
    id: "paramount-denver",
    connector: "kseTicketmaster",
    cadence: "weekly",
    enabled: true,
    sourceLabel: "Ticketmaster",
    kseTmVenueId: "KovZpZAFa1nA",
  };

  it("returns upcoming events with landscape image picked", async () => {
    mockJsonOnce([
      {
        id: "tm-1",
        name: "Comedy Night",
        url: "https://www.ticketmaster.com/event/comedy-1",
        info: "A great show.",
        dates: { start: { dateTime: FUTURE_ISO, localDate: FUTURE_DATE } },
        images: [
          { url: "https://img.tm.com/portrait.jpg", width: 640, height: 1080 },
          { url: "https://img.tm.com/landscape.jpg", width: 1024, height: 576 },
          { url: "https://img.tm.com/small-landscape.jpg", width: 200, height: 113 },
        ],
        _embedded: {
          venues: [
            {
              name: "Paramount Theatre",
              city: { name: "Denver" },
              state: { stateCode: "CO" },
              address: { line1: "1621 Glenarm Pl" },
            },
          ],
        },
      },
    ]);
    const items = await fetchKseTicketmaster(source);
    expect(items).toHaveLength(1);
    expect(items[0].imageUrl).toBe("https://img.tm.com/landscape.jpg");
    expect(items[0].venueName).toBe("Paramount Theatre");
    expect(items[0].address).toBe("1621 Glenarm Pl, Denver, CO");
  });

  it("drops past events", async () => {
    mockJsonOnce([
      {
        id: "old",
        name: "Past",
        dates: { start: { dateTime: "2020-01-01T00:00:00Z" } },
      },
    ]);
    const items = await fetchKseTicketmaster(source);
    expect(items).toEqual([]);
  });
});

describe("fetchNbaSchedule", () => {
  const source: SourceConfig = {
    id: "nuggets-home",
    connector: "nbaSchedule",
    cadence: "weekly",
    enabled: true,
    sourceLabel: "Website",
    url: "https://www.nba.com/nuggets/schedule",
    nbaHomeTeamTricode: "DEN",
  };

  it("filters to home games for the configured tricode", async () => {
    const html = `
      <script id="__NEXT_DATA__">${JSON.stringify({
        props: {
          pageProps: {
            scheduleData: {
              schedule: [
                {
                  gameId: "0022500001",
                  gameStatus: 1,
                  gameDateUTC: FUTURE_ISO,
                  arenaName: "Ball Arena",
                  arenaCity: "Denver",
                  arenaState: "CO",
                  homeTeam: { teamCity: "Denver", teamName: "Nuggets", teamTricode: "DEN" },
                  awayTeam: { teamCity: "Los Angeles", teamName: "Lakers", teamTricode: "LAL" },
                },
                {
                  // Away game — should be filtered out.
                  gameId: "0022500002",
                  gameStatus: 1,
                  gameDateUTC: FUTURE_ISO,
                  homeTeam: { teamTricode: "LAL" },
                  awayTeam: { teamTricode: "DEN" },
                },
                {
                  // Final — should be filtered out.
                  gameId: "0022400003",
                  gameStatus: 3,
                  gameDateUTC: FUTURE_ISO,
                  homeTeam: { teamTricode: "DEN" },
                  awayTeam: { teamTricode: "GSW" },
                },
              ],
            },
          },
        },
      })}</script>
    `;
    mockTextOnce(html);
    const items = await fetchNbaSchedule(source);
    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("nuggets-home:0022500001");
    expect(items[0].text).toContain("Denver Nuggets vs. Los Angeles Lakers");
    expect(items[0].venueName).toBe("Ball Arena");
  });

  it("throws when __NEXT_DATA__ is missing", async () => {
    mockTextOnce("<html></html>");
    await expect(fetchNbaSchedule(source)).rejects.toThrow("__NEXT_DATA__");
  });
});

describe("fetchNhlSchedule", () => {
  const source: SourceConfig = {
    id: "avalanche-home",
    connector: "nhlSchedule",
    cadence: "weekly",
    enabled: true,
    sourceLabel: "Website",
    nhlTeamTricode: "COL",
  };

  it("returns upcoming home games framed from the home side", async () => {
    mockJsonOnce({
      games: [
        {
          id: 2026020001,
          gameState: "FUT",
          startTimeUTC: FUTURE_ISO,
          venue: { default: "Ball Arena" },
          homeTeam: {
            abbrev: "COL",
            placeName: { default: "Colorado" },
            commonName: { default: "Avalanche" },
          },
          awayTeam: {
            abbrev: "BOS",
            placeName: { default: "Boston" },
            commonName: { default: "Bruins" },
          },
          tvBroadcasts: [{ network: "ESPN" }],
        },
        {
          id: 2026020002,
          gameState: "FUT",
          startTimeUTC: FUTURE_ISO,
          homeTeam: { abbrev: "BOS" },
          awayTeam: { abbrev: "COL" },
        },
        {
          id: 2025020003,
          gameState: "FINAL",
          startTimeUTC: FUTURE_ISO,
          homeTeam: { abbrev: "COL" },
          awayTeam: { abbrev: "VGK" },
        },
      ],
    });
    const items = await fetchNhlSchedule(source);
    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("avalanche-home:2026020001");
    expect(items[0].text).toContain("Colorado Avalanche vs. Boston Bruins");
    expect(items[0].text).toContain("Broadcast: ESPN");
    expect(items[0].venueName).toBe("Ball Arena");
  });
});

describe("fetchVenuePilot", () => {
  const source: SourceConfig = {
    id: "levitt-denver",
    connector: "venuePilot",
    cadence: "weekly",
    enabled: true,
    sourceLabel: "Website",
    venuePilotAccountIds: [42],
  };

  it("maps publicEvents rows to RawItems and picks the highlighted cover image", async () => {
    mockJsonOnce({
      data: {
        publicEvents: [
          {
            id: "vp-1",
            name: "Summer Series",
            date: FUTURE_DATE,
            startTime: "19:00",
            description: "Outdoor concert.",
            websiteUrl: "https://levitt.example/event/vp-1",
            venue: { name: "Levitt Pavilion" },
            announceImages: [
              { highlighted: false, versions: { cover: { src: "https://x.com/a.jpg" } } },
              { highlighted: true, versions: { cover: { src: "https://x.com/hero.jpg" } } },
            ],
          },
        ],
      },
    });
    const items = await fetchVenuePilot(source);
    expect(items).toHaveLength(1);
    expect(items[0].sourceUrl).toBe("https://levitt.example/event/vp-1");
    expect(items[0].imageUrl).toBe("https://x.com/hero.jpg");
    expect(items[0].venueName).toBe("Levitt Pavilion");
    expect(items[0].text).toContain(`When: ${FUTURE_DATE} at 19:00`);
  });

  it("throws when GraphQL returns errors", async () => {
    mockJsonOnce({ errors: [{ message: "bad request" }] });
    await expect(fetchVenuePilot(source)).rejects.toThrow("bad request");
  });
});

describe("fetchWixEvents", () => {
  const source: SourceConfig = {
    id: "denverartsociety",
    connector: "wixEvents",
    cadence: "weekly",
    enabled: true,
    sourceLabel: "Website",
    url: "https://www.example-wix-site.com/events",
  };

  // A real instance JWT is a 3-segment base64url string whose middle segment
  // decodes to JSON containing the events-app id. Build a minimal stand-in.
  function makeJwt(appDefId: string) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ appDefId })).toString("base64url");
    return `${header}.${payload}.signature`;
  }

  it("extracts the events-app JWT from the site HTML and posts to the v3 events API", async () => {
    const eventsJwt = makeJwt("140603ad-af8d-84a5-2c80-a0f60cb47351");
    const otherJwt = makeJwt("99999999-0000-0000-0000-000000000000");
    const html = `
      <html><body>
        <script>window.__INIT__ = { foo: { "instance":"${otherJwt}" }, bar: { "instance":"${eventsJwt}" } };</script>
      </body></html>
    `;
    mockTextOnce(html);
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        events: [
          {
            id: "wix-1",
            title: "Open Studios",
            status: "UPCOMING",
            mainImage: { url: "https://static.wixstatic.com/photo.jpg" },
            location: {
              name: "Denver Arts Society",
              address: { formattedAddress: "734 Santa Fe Dr, Denver, CO" },
            },
            dateAndTimeSettings: { startDate: FUTURE_ISO },
            eventPageUrl: { base: "https://example.com", path: "/event/wix-1" },
          },
        ],
      }),
      text: async () => "",
    } as unknown as Response);

    const items = await fetchWixEvents(source);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.sourceUrl).toBe("https://example.com/event/wix-1");
    expect(item.venueName).toBe("Denver Arts Society");
    expect(item.imageUrl).toBe("https://static.wixstatic.com/photo.jpg");

    // First call fetched the site HTML; second call hits the events API.
    // Confirm the events JWT (not the other app's) was forwarded.
    const apiCall = fetchSpy.mock.calls[1];
    expect(apiCall[0]).toBe("https://www.wixapis.com/events/v3/events/query");
    const init = apiCall[1] as RequestInit;
    const authHeader = (init.headers as Record<string, string>).Authorization;
    expect(authHeader).toBe(eventsJwt);
  });

  it("throws when no events-app token is present", async () => {
    const html = `<html><body><script>window.x = { "instance":"${makeJwt("other-app-id")}" }</script></body></html>`;
    mockTextOnce(html);
    await expect(fetchWixEvents(source)).rejects.toThrow("instance token not found");
  });
});
