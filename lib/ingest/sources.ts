import type { SourceConfig } from "./types";

// Hybrid scraping strategy:
// - SerpAPI (Google Events) for broad, multi-category, multi-venue coverage at low cost.
// - Apify Instagram for deep coverage of specific venues / hashtags Google misses.
// - Apify Web (cheerio-scraper) for JS-heavy or niche sites Google Events doesn't index.
export const SOURCES: SourceConfig[] = [
  // ── SerpAPI: broad coverage by category. Cheap (~$0.01/query), so daily is fine.
  {
    id: "denver-events-search",
    enabled: true,
    connector: "serpEvents",
    cadence: "daily",
    sourceLabel: "Website",
    query: "events in Denver this week",
    serpHtichips: "date:week",
  },
  {
    id: "denver-food-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "food festivals and tastings Denver",
    defaultCategory: "Food & Drink",
  },
  {
    id: "denver-comedy-shows",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "comedy shows Denver",
    defaultCategory: "Comedy",
  },
  {
    id: "denver-arts-culture",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "art shows and gallery openings Denver",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "denver-outdoor-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "outdoor events and farmers markets Denver",
    defaultCategory: "Outdoor",
  },
  {
    id: "denver-music-shows",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "live music and concerts Denver",
    defaultCategory: "Music",
  },
  {
    id: "denver-sports-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "sports events Denver",
    defaultCategory: "Sports",
  },
  {
    id: "denver-wellness-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "yoga and wellness classes Denver",
    defaultCategory: "Wellness",
  },
  {
    // Google Events returned no results for "markets and pop-ups Denver" — overlap
    // with denver-outdoor-events (farmers markets) is heavy. Disabled until we
    // find a query that surfaces non-redundant content.
    id: "denver-markets-popups",
    enabled: false,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "weekend markets Denver",
    defaultCategory: "Markets",
  },
  {
    id: "denver-this-weekend",
    enabled: true,
    connector: "serpEvents",
    cadence: "daily",
    sourceLabel: "Website",
    query: "things to do in Denver this weekend",
    serpHtichips: "date:weekend",
  },
  {
    id: "denver-free-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "free events Denver",
  },
  {
    id: "denver-family-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "family-friendly events Denver",
  },
  {
    // Denver has a strong dog-park / brewery-patio scene; explicit query gets
    // us non-overlapping coverage that "events in Denver this week" misses.
    // Google Events is finicky with the phrase "dog-friendly" — concrete
    // event types ("yappy hour", "dog meetup") return more results than
    // adjective queries.
    id: "denver-dog-friendly-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "dog events Denver",
  },
  {
    // Date-night results were under-tagged because no source explicitly
    // queries for them. Bars, jazz, and cocktail spots get surfaced here so
    // the AI has more candidates to apply the date-night tag.
    id: "denver-date-night-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "date night spots and live jazz Denver",
  },

  // ── Apify Instagram: per-account deep dives for venues we follow closely.
  {
    id: "mission-ballroom-ig",
    enabled: true,
    connector: "instagram",
    cadence: "daily",
    sourceLabel: "Instagram",
    handle: "missionballroom",
    defaultVenueSlug: "mission-ballroom",
    defaultCategory: "Music",
  },
  {
    // Denver music venues — single source fans out across multiple handles
    // in one Apify run. Add more handles here as we discover venues that
    // post events on Instagram.
    id: "denver-music-venues-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: [
      "ogdentheatre",
      "fillmoredenver",
      "redrocksco",
      "blubirdtheater",
      "hidiveofficial",
      "thelionslairlounge",
    ],
    defaultCategory: "Music",
  },

  // ── Apify Instagram: hashtag scrapes for lifestyle coverage. Hashtags
  // surface community-organized events (yappy hours, dog meetups, brewery
  // patios) that Google Events doesn't index. Multi-hashtag fans out in a
  // single Apify run; per-URL cap is MAX_POSTS in the connector.
  {
    id: "denver-dogs-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denverdogs",
      "denverdogfriendly",
      "yappyhourdenver",
      "milehighdogs",
      "denverdogevents",
    ],
  },
  {
    id: "denver-family-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denverfamily",
      "denverkids",
      "denvermom",
      "milehighmama",
    ],
  },
  {
    id: "denver-outdoor-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denveroutdoors",
      "denverhiking",
      "denverparks",
      "milehighoutdoors",
    ],
  },
  {
    id: "denver-datenight-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denverdatenight",
      "denvercocktails",
      "denverwine",
      "denverjazz",
    ],
  },

  // ── Denver venue + aggregator scrapes — web + Instagram. Each data source
  // gets an apifyWeb entry (LLM-extract fallback, no per-site selectors needed)
  // and, where it exists, an Instagram entry. Single-venue sources set
  // defaultVenueSlug so listings pin to the seeded venue
  // (supabase/migrations/20260603170000_scraping_source_venues.sql). Aggregators
  // that cover many venues omit it and let resolveOrCreateVenue() resolve per
  // event. All weekly to bound Apify spend; sharded across cron days in vercel.json.

  // Physical venues — defaultVenueSlug links every listing to the venue's map pin.
  {
    id: "highlands-farmers-market-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://thehighlandsfarmersmarket.com/",
    defaultVenueSlug: "highlands-farmers-market",
    defaultCategory: "Markets",
  },
  // The Highlands Farmers Market has no Instagram profile (N/A in the source list).
  {
    id: "red-rocks-amphitheatre-web",
    enabled: true,
    // Static WordPress events grid — in-process cheerio (free) extracts the
    // full card list cleanly, no Apify needed.
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.redrocksonline.com/events/",
    selectors: {
      item: ".card-event",
      title: ".card-title",
      date: ".date",
      link: "a",
      image: "img",
    },
    // The grid lists 150+ shows through the whole season; cap to the soonest
    // batch so one run doesn't normalize the entire calendar.
    maxItems: 50,
    defaultVenueSlug: "red-rocks-amphitheatre",
    defaultCategory: "Music",
  },
  {
    id: "red-rocks-amphitheatre-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "redrocksco",
    defaultVenueSlug: "red-rocks-amphitheatre",
    defaultCategory: "Music",
  },
  {
    id: "levitt-pavilion-denver-web",
    enabled: true,
    // Site embeds a VenuePilot JS widget (#/events) — nothing in the page HTML
    // to scrape. Pull structured events straight from VenuePilot's public API.
    connector: "venuePilot",
    cadence: "weekly",
    sourceLabel: "Website",
    venuePilotAccountIds: [1105],
    maxItems: 60,
    defaultVenueSlug: "levitt-pavilion-denver",
    defaultCategory: "Music",
  },
  {
    id: "levitt-pavilion-denver-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "levitt_denver",
    defaultVenueSlug: "levitt-pavilion-denver",
    defaultCategory: "Music",
  },
  {
    id: "denver-beer-co-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denverbeerco.com/event-calendar/",
    selectors: {
      item: ".event-row",
      title: ".title",
      date: ".col-lg-2",
      description: ".excerpt",
      link: ".title",
    },
    maxItems: 40,
    defaultVenueSlug: "denver-beer-co",
    defaultCategory: "Food & Drink",
  },
  {
    id: "denver-beer-co-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denverbeerco",
    defaultVenueSlug: "denver-beer-co",
    defaultCategory: "Food & Drink",
  },
  {
    id: "rino-art-district-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://rinoartdistrict.org/visit/events-calendar",
    selectors: {
      item: ".evcard",
      title: ".evcard-content-headline",
      date: ".evcard-date-box",
      description: ".evcard-content-text",
      image: ".evcard-image-image",
    },
    maxItems: 40,
    defaultVenueSlug: "rino-art-district",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "rino-art-district-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "rinoartdistrict",
    defaultVenueSlug: "rino-art-district",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "denver-museum-nature-science-web",
    // Disabled: dmns.org runs on Blazor Server (UI state over a SignalR
    // websocket) with no scrapeable HTML or public events API; the editorial
    // pages are evergreen program categories, not a dated event feed. DMNS
    // exhibitions arrive via Visit Denver; curated events come from Instagram
    // below (venue-pinned to the museum).
    enabled: false,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.dmns.org/",
    defaultVenueSlug: "denver-museum-nature-science",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "denver-museum-nature-science-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denvermuseumns",
    defaultVenueSlug: "denver-museum-nature-science",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "little-blue-pigeon-web",
    enabled: true,
    // Wix Events site — parse the embedded wix-warmup-data JSON.
    connector: "wixEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.littlebluepigeonbooks.com/event-list",
    maxItems: 40,
    defaultVenueSlug: "little-blue-pigeon",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "little-blue-pigeon-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "littlebluepigeonbooks",
    defaultVenueSlug: "little-blue-pigeon",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "ball-arena-web",
    enabled: true,
    // Calendar is a FullCalendar widget backed by KSE's JSON events feed
    // (Ticketmaster-linked). Pull the feed directly.
    connector: "fullCalendarFeed",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://alttix.ksehq.com/api/tm/Calendar?Id=1",
    maxItems: 60,
    defaultVenueSlug: "ball-arena",
  },
  {
    id: "ball-arena-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "ballarenadenver",
    defaultVenueSlug: "ball-arena",
  },
  {
    id: "cerebral-brewing-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://cerebralbrewing.com/",
    defaultVenueSlug: "cerebral-brewing",
    defaultCategory: "Food & Drink",
  },
  {
    id: "cerebral-brewing-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "cerebralbrewing",
    defaultVenueSlug: "cerebral-brewing",
    defaultCategory: "Food & Drink",
  },

  // Sports teams — pin to their home venue. Team sites (mlb/nba/nhl/nfl) are
  // JS-heavy SPAs, so the web scrape may yield little; Instagram + the existing
  // denver-sports-events SerpAPI source carry the real coverage. Web kept on
  // (cheap) in case the static fallback surfaces schedule/promo pages.
  {
    id: "colorado-rockies-web",
    enabled: true,
    // mlb.com is a heavy SPA; pull the schedule from MLB's public StatsAPI
    // instead, on a rolling forward window (auto-advances, home games only).
    connector: "mlbSchedule",
    cadence: "weekly",
    sourceLabel: "Website",
    mlbTeamId: 115,
    maxItems: 60,
    defaultVenueSlug: "coors-field",
    defaultCategory: "Sports",
  },
  {
    id: "colorado-rockies-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "rockies",
    defaultVenueSlug: "coors-field",
    defaultCategory: "Sports",
  },
  {
    id: "denver-broncos-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denverbroncos.com/",
    defaultVenueSlug: "empower-field",
    defaultCategory: "Sports",
  },
  {
    id: "denver-broncos-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "broncos",
    defaultVenueSlug: "empower-field",
    defaultCategory: "Sports",
  },
  {
    id: "denver-nuggets-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.nba.com/nuggets/",
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
  },
  {
    id: "denver-nuggets-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "nuggets",
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
  },
  {
    id: "colorado-avalanche-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.nhl.com/avalanche/",
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
  },
  {
    id: "colorado-avalanche-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "coloradoavalanche",
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
  },

  // Aggregators / multi-venue — no defaultVenueSlug; resolveOrCreateVenue()
  // resolves a venue per event from the LLM-extracted name + address.
  {
    id: "highlands-square-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    // /events is a JS-rendered calendar (static scrape finds no events), but
    // each flagship event has its own static page. Scrape those directly.
    url: [
      "https://visitdenverhighlands.com/highlands-street-fair",
      "https://visitdenverhighlands.com/highlands-farmers-market",
      "https://visitdenverhighlands.com/highlands-oktoberfest",
      "https://visitdenverhighlands.com/harvest-festival-and-trick-or-treat-street",
      "https://visitdenverhighlands.com/holiday-in-the-highlands",
    ],
    // These flagship events all happen in the Highlands Square district, so pin
    // them to one canonical venue instead of letting each page resolve a noisy
    // per-event venue. (The IG source stays unpinned — it covers other venues.)
    defaultVenueSlug: "highlands-square",
  },
  {
    id: "highlands-square-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "visitdenverhighlands",
  },
  {
    id: "mile-high-on-the-cheap-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.milehighonthecheap.com/events/",
    selectors: {
      item: ".event",
      title: "h3",
      description: ".meta",
      link: "a",
    },
    maxItems: 40,
  },
  {
    id: "mile-high-on-the-cheap-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "milehighcheap",
  },
  {
    id: "visit-denver-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.visitdenver.com/events/",
    selectors: {
      item: ".slide",
      title: ".slide-title",
      date: ".mini-date-section",
      description: ".description",
      link: "a",
      image: "img",
    },
    maxItems: 40,
  },
  {
    id: "visit-denver-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "visitdenver",
  },
  {
    id: "denver-film-web",
    // Disabled: denverfilm.org is an Eventive cinema catalog (1,200+ films +
    // daily Sie FilmCenter showtimes) — too granular/noisy for a discovery app,
    // and the clean events endpoint needs a secret API key. Denver Film's
    // notable events (festival, Film on the Rocks, premieres) arrive via Visit
    // Denver / Mile High / SerpAPI; curated highlights come from Instagram below.
    enabled: false,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denverfilm.org/",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "denver-film-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "thedenverfilm",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "lodo-love-web",
    enabled: true,
    // CityKit .evcard calendar (same structure as RiNo Art District).
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://lodolove.com/events/calendar",
    selectors: {
      item: ".evcard",
      title: ".evcard-content-headline",
      date: ".evcard-date-box",
      description: ".evcard-content-text",
      image: ".evcard-image-image",
    },
    maxItems: 40,
  },
  {
    id: "lodo-love-ig",
    // Disabled: @lodolovedenver is a district-marketing/brand account (promo &
    // lifestyle posts, not datable events) — a full 30-post scrape yielded 0
    // events. LoDo Love's actual events come from its website calendar above.
    enabled: false,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "lodolovedenver",
  },
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export function getSource(id: string): SourceConfig | undefined {
  return BY_ID.get(id);
}

export function getEnabledSources(cadence?: SourceConfig["cadence"]): SourceConfig[] {
  return SOURCES.filter(
    (s) => s.enabled && (cadence === undefined || s.cadence === cadence),
  );
}
