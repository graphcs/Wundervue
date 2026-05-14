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

  // ── Direct-scrape: visitdenver.com landing page. Server-rendered featured
  // events curated by the city's tourism board — high signal but limited
  // volume (~70 tiles), so weekly cadence is plenty.
  {
    id: "visitdenver-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.visitdenver.com/events/",
    selectors: {
      item: ".slide:has(.slide-title)",
      title: ".slide-title a",
      // VisitDenver renders the venue (and sometimes a date) inside .info-item
      // list rows. Bundling them into "description" gets them into the prose
      // blob so the normalizer LLM can extract venue/date/category.
      description: ".info-item",
      link: ".slide-title a",
      image: "img",
    },
  },

  // ── Ball Arena — Denver's marquee indoor venue (Nuggets, Avalanche, big
  // concerts). The /misc/all-events/ page is the canonical full schedule:
  // ~87 events spanning playoffs + concerts + parking listings. Images
  // are 640x360 16:9 (passes our aspect floor) so most events get real
  // scraped images, keeping AI-gen cost low. Cap at 30 — covers the next
  // ~2 months. Heavy overlap with ticketmaster-denver expected; dedup
  // should fold matches.
  {
    id: "ball-arena-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.ballarena.com/misc/all-events/",
    selectors: {
      item: ".card-wrap",
      title: ".card-title",
      description: ".card-body",
      link: "a",
      image: "img",
    },
    maxItems: 30,
    defaultVenueSlug: "ball-arena",
  },

  // ── Little Blue Pigeon Books — independent Denver bookstore on a Wix
  // site. Wix Events is JS-rendered, but its v3 query API (auth via the
  // instance JWT embedded in the page) returns clean structured events.
  // The connector auto-extracts the token from the events page on every
  // run so we never need to refresh credentials manually.
  {
    id: "little-blue-pigeon-events",
    enabled: true,
    connector: "wixEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.littlebluepigeonbooks.com/event-list",
    maxItems: 25,
  },

  // ── Denver Museum of Nature & Science — temporary exhibitions page lists
  // 3 active special exhibitions in `.expandable-card` tiles with dates in
  // the description prose ("Now Open Through Sept 7", "Opens June 12").
  // Permanent exhibitions are excluded (they're "always open" — not events).
  // The site's /programs-and-events/ page is a template stub right now;
  // skip until they populate it.
  {
    id: "dmns-exhibitions",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.dmns.org/exhibitions/temporary-exhibitions/",
    selectors: {
      item: ".expandable-card",
      title: "h2",
      description: ".card-text",
      link: "a",
      image: "img",
    },
    defaultVenueSlug: "denver-museum-of-nature-science",
  },

  // ── Denver Film via Eventive's public API. The denverfilm.org site
  // delegates all screening management to Eventive (denverfilm.eventive.org)
  // — a JS-only SPA, but its api.eventive.org backend is reachable with
  // the public api_key from the tenant bundle. Year-round bucket includes
  // Film on the Rocks, CinemaQ, Sci-Fi Series, Sunset Cinema, Summer Scream,
  // National Theatre Live, plus regular Sie FilmCenter programming. The
  // bucket holds 138 upcoming events — cap at 30 to keep the LLM+image
  // pipeline well under Vercel's 5min ceiling.
  {
    id: "denver-film-events",
    enabled: true,
    connector: "eventive",
    cadence: "daily",
    sourceLabel: "Website",
    eventiveTenant: "denverfilm",
    // Public anon key + bucket ID extracted from
    // denverfilm.eventive.org/denverfilm.<hash>.js. They rotate rarely;
    // refresh by re-inspecting the bundle if the API starts returning 401.
    eventiveApiKey: "285f587b83e6ab326e737e00d62ca378",
    eventiveEventBucketId: "5ed7cb60eb909700905eb9e4",
    maxItems: 30,
  },

  // ── RiNo Art District — neighborhood arts org. Their /visit/events-calendar
  // page lists ~120 events across the district in `.evcard` tiles (no
  // <img>, but `.evcard-image-image[data-src]` holds the URL — handled by
  // pickImageAttr's data-src branch). Card hrefs live on the .evcard div
  // itself (the connector falls back to that when find() misses).
  // Cap at 40 (most cards have square images that trigger AI gen).
  {
    id: "rino-art-district-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://rinoartdistrict.org/visit/events-calendar",
    selectors: {
      item: ".evcard",
      title: ".evcard-content-headline",
      // Whole content block gives title + subhead + body text + venue
      // ("5:30pm - 8pm / Shop at MATTER") for the LLM to extract.
      description: ".evcard-content",
      date: ".evcard-date-box",
      image: ".evcard-image-image",
    },
    // 40-item run measured 5:59 (over Vercel's 5min ceiling) because most
    // RiNo card images are 900x900 squares that trigger AI gen. Cap at 25
    // to keep weekly runs comfortably under budget.
    maxItems: 25,
  },

  // ── Denver Beer Co — multi-taproom brewery with run clubs, music bingo,
  // and concert presales. The featured-events grid (.one-post tiles)
  // carries title + location + date in the text blob; LLM extracts. Low
  // yield today (cards skew toward past/recently-passed dates) but
  // ongoing recurring series ("Sunset Sessions", "Thursday Run Club")
  // will surface as soon as DBC bumps their featured slots forward.
  {
    id: "denverbeerco-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denverbeerco.com/event-calendar/",
    selectors: {
      item: ".one-post",
      title: "h5",
      // .post-info wraps the location, title, and date text — gives the
      // LLM enough context to extract the date even when no <img> exists
      // (the card image is a CSS background-image, which pickImageAttr
      // doesn't see; image pipeline falls through to og:image on the
      // event detail page).
      description: ".post-info",
      date: ".card-date",
      link: 'a[href*="/events/"]',
      image: "img",
    },
  },

  // ── Levitt Pavilion Denver via VenuePilot's GraphQL. The site itself
  // (levittdenver.org) renders events client-side from a VenuePilot widget
  // — Squarespace's events collection is empty. Hitting VenuePilot's
  // publicEvents query directly with the venue's accountId gives us the
  // same data the widget shows, with images. Weekly cadence; cap at 30
  // (concert posters are 900x900 squares → all events trigger AI image
  // gen, which keeps the run inside Vercel's 5min ceiling).
  {
    id: "levitt-denver-events",
    enabled: true,
    connector: "venuePilot",
    cadence: "weekly",
    sourceLabel: "Website",
    venuePilotAccountIds: [1105],
    maxItems: 30,
    defaultVenueSlug: "levitt-pavilion-denver",
    defaultCategory: "Music",
  },

  // ── Direct-scrape: visitdenver.com homepage. Disabled: the
  // .track-slide tiles only carry titles (no date/description text), so
  // 5 of 6 inserts landed with date_start=null and never surface on
  // /explore. The /events/ page (visitdenver-events) already covers the
  // substantive content. Keep this config around in case we later
  // implement a follow-the-link mode that pulls dates from each event's
  // detail page.
  {
    id: "visitdenver-homepage",
    enabled: false,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.visitdenver.com/",
    selectors: {
      item: '.slide.track-slide:has(a[href*="/event/"])',
      title: 'a[href*="/event/"]',
      link: 'a[href*="/event/"]',
      image: "img",
    },
  },

  // ── Direct-scrape: Ticketmaster Discovery (Denver concerts). The page
  // embeds a JSON-LD MusicEvent array with full structured event data
  // (name, dates, venue, address, geo, image) — more reliable than
  // scraping their class-mangled SPA markup.
  {
    id: "ticketmaster-denver",
    enabled: true,
    connector: "jsonLdEvents",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://www.ticketmaster.com/discover/concerts/denver",
    defaultCategory: "Music",
  },

  // ── Direct-scrape: Eventbrite Denver "all events" page. Embeds a
  // schema.org ItemList with each event as a nested Event object —
  // includes title, dates, image, venue, and url.
  {
    id: "eventbrite-denver",
    enabled: true,
    connector: "jsonLdEvents",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://www.eventbrite.com/d/co--denver/all-events/",
  },

  // ── Direct-scrape: Red Rocks Park & Amphitheatre (redrocksonline.com).
  // Server-rendered WordPress with ~180 upcoming events visible at a time
  // (~6 months out). Each card carries date + title + a canonical
  // /events/<slug>/ permalink; images lazy-load via the theme's
  // `data-image` attr (picked up by imagePicker's extended fallback chain).
  // Weekly cadence is plenty — Red Rocks announces shows weeks in advance.
  {
    id: "redrocks-online-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.redrocksonline.com/events/",
    selectors: {
      item: ".card.card-event",
      title: "h3.card-title",
      date: ".date",
      link: "a",
      image: "img",
    },
    // Page renders ~180 events going 6 months out, in date-ascending order.
    // Most card images are square artist photos (500x500 or 564x564) — they
    // fail our pipeline's landscape-only aspect check (1.2-2.4), so nearly
    // every event triggers AI image gen at ~5s each. Processing 60+ blows
    // past Vercel's 5min function ceiling. Cap at 25 (next ~3 weeks); each
    // subsequent weekly cron picks up the next batch as events approach.
    maxItems: 25,
    defaultVenueSlug: "red-rocks-amphitheatre",
    defaultCategory: "Music",
  },

  // ── Direct-scrape: Mile High on the Cheap (milehighonthecheap.com).
  // Homepage is a feed of ~20 curated "things to do" / deals articles,
  // each with a title + a rich excerpt containing event dates, venues, and
  // prices in the prose. LLM normalizer rejects pure deal-roundup pieces
  // (Amazon Deals, etc.) as non-events; concrete events (Spring Shindig,
  // local festivals) land with extracted dates. Daily cadence: MHC posts
  // multiple articles per day and the homepage rolls quickly.
  {
    id: "milehigh-on-the-cheap",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://www.milehighonthecheap.com/",
    selectors: {
      item: "article",
      title: ".entry-title",
      description: ".entry-content",
      link: ".entry-title a",
      image: "img",
    },
  },

  // ── Direct-scrape: Highland Square (visitdenverhighlands.com). The site's
  // Events nav is a dropdown of dedicated pages, one per recurring annual
  // event. Each page is server-rendered Squarespace HTML — title in <h2>,
  // dates buried in the prose, one hero image. The calendar block at /events
  // is JS-rendered and currently empty, so we target the per-event pages
  // instead. Weekly cadence: these are stable annual events that change copy
  // rarely.
  {
    id: "highland-square-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    urls: [
      "https://visitdenverhighlands.com/highlands-street-fair",
      "https://visitdenverhighlands.com/highlands-farmers-market",
      "https://visitdenverhighlands.com/highlands-oktoberfest",
      "https://visitdenverhighlands.com/harvest-festival-and-trick-or-treat-street",
      "https://visitdenverhighlands.com/holiday-in-the-highlands",
    ],
    selectors: {
      item: "body",
      title: "h1, h2",
      // Whole-main text as the prose blob — date strings live inline ("June
      // 20, 2026", "Sundays, May - October 25th, 2026") and the normalizer
      // LLM extracts dates / venue / category from there.
      description: "main",
      image: "main img",
    },
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
    // 6 handles can over-deliver: a prior uncapped run pulled 539 raw
    // posts. Cap so the LLM normalize + image pipeline fits inside Vercel's
    // 5min function ceiling. Apify returns posts newest-first, so we keep
    // the freshest 100.
    maxItems: 100,
    defaultCategory: "Music",
  },
  {
    // Highland Square Denver — neighborhood association posts community
    // events (street fairs, farmers market, holiday gatherings). Single
    // handle for now; if we add more neighborhood/curator accounts later
    // they can join as a `denver-neighborhoods-ig` multi-handle source.
    // Denver editorial / tourism curators — both post daily picks (events,
    // deals, restaurant openings, things to do). MileHighCheap leans
    // budget-friendly events + deals; visitdenver is the city tourism
    // board's official IG. Bundled in one Apify run for cost; cap at 60
    // so the LLM+image pipeline stays inside Vercel's 5min ceiling (cap=80
    // ran 5:15 in test, just over budget).
    id: "denver-curators-ig",
    enabled: true,
    connector: "instagram",
    cadence: "daily",
    sourceLabel: "Instagram",
    handle: ["MileHighCheap", "visitdenver"],
    maxItems: 60,
  },
  {
    id: "highland-square-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "visitdenverhighlands",
  },
  {
    // Levitt Pavilion Denver — outdoor amphitheatre. Website is covered
    // via VenuePilot GraphQL; this catches anything they announce on IG
    // before it lands in the VenuePilot calendar (lineup teases, pop-up
    // events, partner shows).
    id: "levitt-denver-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "levitt_denver",
    defaultVenueSlug: "levitt-pavilion-denver",
    defaultCategory: "Music",
  },
  {
    // Little Blue Pigeon Books — independent bookstore. Website covered via
    // Wix Events API; IG catches pop-up signings, partner events, and
    // last-minute additions before they hit the Wix calendar.
    id: "little-blue-pigeon-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "littlebluepigeonbooks",
  },
  {
    // Denver Museum of Nature & Science — IG catches one-off member events,
    // After Hours nights, lectures, and exhibit openings that aren't on the
    // /exhibitions/temporary-exhibitions/ page (which only lists the 3 big
    // current exhibits).
    id: "dmns-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denvermuseumns",
    defaultVenueSlug: "denver-museum-of-nature-science",
  },
  {
    // Denver Film — cinema/festival org. Website covered via Eventive API
    // (year-round bucket). IG catches non-screening events (member parties,
    // partnership announcements, behind-the-scenes premieres) that don't
    // land in Eventive.
    id: "denver-film-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "thedenverfilm",
  },
  {
    // RiNo Art District — neighborhood arts org. Website covers the full
    // event calendar; IG catches gallery openings, pop-ups, and street-art
    // events posted before they make the calendar.
    id: "rino-art-district-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "rinoartdistrict",
  },
  {
    // Denver Beer Co — disabled because Apify's unauthenticated IG
    // scraper hits Instagram's age-gate on the profile ("sensitive
    // content" because alcohol) and returns 0 posts. Resolving needs
    // session cookies, which we don't pass through. Keep this config in
    // case we later add cookie-based auth to the IG connector.
    id: "denverbeerco-ig",
    enabled: false,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denverbeerco",
  },

  // ── Apify Instagram: hashtag scrapes for lifestyle coverage. Hashtags
  // surface community-organized events (yappy hours, dog meetups, brewery
  // patios) that Google Events doesn't index. Multi-hashtag fans out in a
  // single Apify run; per-URL cap is MAX_POSTS in the connector. maxItems
  // caps the post-Apify output so a high-volume tag set doesn't blow past
  // Vercel's 5min function ceiling.
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
    maxItems: 80,
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
    maxItems: 80,
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
    maxItems: 80,
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
    maxItems: 80,
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
