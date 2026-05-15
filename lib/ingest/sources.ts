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

  // ── Denver Summit FC — NWSL women's pro soccer team. Their /schedule
  // page server-renders 22 `.schedule__match` ARTICLE blocks with full
  // microdata. Includes both home (DICK'S Sporting Goods Park, Centennial
  // Stadium) and away games — we scrape all and let the LLM normalize;
  // the explore feed naturally sorts by date, and away games with venues
  // outside Denver still represent legitimate fan interest. Weekly
  // cadence — schedule rolls forward by week.
  {
    id: "denver-summit-fc-games",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denversummitfc.com/schedule/",
    selectors: {
      item: ".schedule__match",
      title: ".schedule__match-opponent-name",
      description: ".schedule__match",
      // No link selector: their /matches/{slug}/ detail pages return 403
      // to our scraper, so the URL liveness check drops every item that
      // points there. Falling back to the schedule URL (one per source)
      // keeps every game alive in the pipeline.
      image: "img",
    },
    defaultCategory: "Sports",
  },

  // ── Colorado Avalanche home games via NHL's public API. The
  // /avalanche/schedule page is a JS-only SPA, but api-web.nhle.com
  // exposes the full season schedule at /club-schedule-season/{tricode}/now.
  // Filters to home games only. Currently 0 upcoming because the 2025-26
  // season ended; will fill in when 2026-27 schedule publishes.
  {
    id: "colorado-avalanche-games",
    enabled: true,
    connector: "nhlSchedule",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.nhl.com/avalanche/schedule/",
    nhlTeamTricode: "COL",
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
    maxItems: 30,
  },

  // ── Paramount Theatre Denver via the KSE Ticketmaster proxy. Their
  // /event-calendar page is a JS-only widget shell; the underlying data
  // comes from alttix.ksehq.com/api/tm/venue/KovZpZAFa1nA (Paramount's
  // Ticketmaster venue ID). Returns the standard TM Discovery API event
  // array with landscape images (1024x683 3:2) that pass our probe's
  // aspect floor cleanly. ~67 upcoming shows; daily cadence picks up
  // new on-sales as they drop.
  {
    id: "paramount-denver-events",
    enabled: true,
    connector: "kseTicketmaster",
    cadence: "daily",
    sourceLabel: "Website",
    kseTmVenueId: "KovZpZAFa1nA",
    maxItems: 30,
    defaultVenueSlug: "paramount-theatre",
  },

  // ── Denver Nuggets home games via the NBA's own schedule page. The
  // schedule is inlined as __NEXT_DATA__ JSON on /nuggets/schedule —
  // far more reliable than scraping the rendered DOM. Filters to home
  // games only (away games happen in other cities). Currently 0
  // upcoming because the 2025-26 season just ended; will fill in when
  // the 2026-27 schedule publishes in late summer. Weekly cadence is
  // plenty — schedules drop in chunks and only change at playoff time.
  {
    id: "denver-nuggets-games",
    enabled: true,
    connector: "nbaSchedule",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.nba.com/nuggets/schedule",
    nbaHomeTeamTricode: "DEN",
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
    maxItems: 30,
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

  // ── Denver Art Society — Santa Fe Arts District nonprofit. Wix site
  // running the older Wix Events v1 app (URL pattern
  // /event-details-registration/{slug}), so our v3-API connector
  // returns 401. Each event has a server-rendered detail page with
  // rich prose (date, time, recurring dates list, og:image) — use
  // cheerioWeb multi-URL like Highland Square.
  {
    id: "denver-art-society-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    urls: [
      "https://www.denverartsociety.org/event-details-registration/3rd-fridays-dj-night-free-1-2026-05-15-19-00",
      "https://www.denverartsociety.org/event-details-registration/sundays-on-santa-fe-art-music-free-event-2026-05-31-12-00",
      "https://www.denverartsociety.org/event-details-registration/first-friday-art-walk-free-1-2026-06-05-19-00",
      "https://www.denverartsociety.org/event-details-registration/open-mic-night-free-1-2026-06-12-19-00",
    ],
    selectors: {
      item: "body",
      title: "h1",
      description: "main, body",
      image: "img",
    },
    defaultCategory: "Arts & Culture",
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

  // ── Denver Zoo — WordPress site with a clean `things-to-do` filter
  // (`?_to_do_by_type=atomic-event`) listing all current public events
  // (~7 cards). Each card has title, full date range, description, and a
  // WP-resize image that stripWpResize promotes to the original. Daily
  // cadence — programs shift seasonally and the zoo bumps their lineup
  // through the year.
  {
    id: "denver-zoo-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://denverzoo.org/things-to-do/?_to_do_by_type=atomic-event",
    selectors: {
      item: ".urbi-card",
      title: ".urbi-card__title",
      description: ".urbi-card__description",
      date: ".urbi-card__date-meta",
      link: 'a[href*="/events/"]',
      image: "img",
    },
    defaultVenueSlug: "denver-zoo",
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

  // ── Comedy Works — Denver comedy club (Downtown at Larimer Square +
  // South locations). /events lists all showtimes in .comedian-box LIs
  // (~193 total — typically 2-4 shows/night per location). Cap at 30 so
  // we get the soonest two weeks of shows; weekly cron picks up the
  // rolling tail. Per-event images are 50x50 thumbnails (Rails
  // active_storage variation); the image pipeline falls through to
  // og:image on the comedian detail page for a usable hero.
  {
    id: "comedy-works-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://comedyworks.com/events",
    selectors: {
      item: ".comedian-box",
      title: ".comedian-box-title",
      date: ".comedian-box-date",
      description: ".comedian-box-content",
      link: 'a[href*="/comedians/"]',
      image: "img",
    },
    maxItems: 30,
    defaultVenueSlug: "comedy-works",
    defaultCategory: "Comedy",
  },

  // ── Great Divide Brewing — RiNo brewery. /events-releases lists only
  // 2 events as thin .weekevents__box cards (no date/description on the
  // card itself), but each links to a rich detail page. Use cheerioWeb's
  // multi-URL mode against the 2 detail pages so the LLM has full prose
  // (dates, venue, description) to work with. defaultVenue great-divide-
  // brewing; pipeline will fall through to og:image since detail pages
  // have proper hero shots set.
  {
    id: "great-divide-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    urls: [
      "https://greatdivide.com/events/sunset-sessions/",
      "https://greatdivide.com/events/tracing-the-divide/",
    ],
    selectors: {
      item: "body",
      title: "h1",
      description: "main, .entry-content",
      image: "img",
    },
    defaultVenueSlug: "great-divide-brewing",
  },

  // ── Denver Arts & Venues — city agency that runs major civic venues
  // (DCPA Buell, Colorado Convention Center, Red Rocks, McNichols, etc.).
  // Their /events page aggregates programming across the portfolio with
  // 12 server-rendered `.eventItem` cards. Heavy expected overlap with
  // other sources (Red Rocks, Eventive, Ticketmaster) — dedup will fold.
  {
    id: "denver-arts-venues-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://www.artsandvenuesdenver.com/events",
    selectors: {
      item: ".eventItem",
      title: "h3.title",
      date: ".date",
      description: ".eventItem",
      link: 'a[href*="/events/detail/"]',
      image: "img",
    },
  },

  // ── Station 26 Brewing — North Park Hill brewery. Squarespace events
  // block (same template as Larimer Square). Programming includes
  // weekly Sunset Sessions live music, Denver Zoo "BEER. ANIMALS.
  // IMPACT." nights, Annual Crawfish Boil, etc.
  {
    id: "station-26-brewing-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.station26brewing.co/events",
    selectors: {
      item: ".eventlist--upcoming .eventlist-event",
      title: ".eventlist-title-link",
      date: ".event-date",
      description: ".eventlist-description, .eventlist-excerpt",
      link: ".eventlist-title-link",
      image: "img",
    },
  },

  // ── Larimer Square — historic Downtown Denver block (shops,
  // restaurants, recurring events). Squarespace site with the standard
  // events block — `.eventlist--upcoming .eventlist-event` server-renders
  // the upcoming list cleanly (12 events; the rest of the page is past
  // events which we ignore by scoping to `--upcoming`).
  {
    id: "larimer-square-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.larimersquare.com/events",
    selectors: {
      item: ".eventlist--upcoming .eventlist-event",
      title: ".eventlist-title-link",
      date: ".event-date",
      description: ".eventlist-description, .eventlist-excerpt",
      link: ".eventlist-title-link",
      image: "img",
    },
  },

  // ── Denver Botanic Gardens — Drupal site with a calendar block
  // server-rendering 20 `.node--type-program-instance` cards per page.
  // Programs span horticulture classes, tours, kids events, therapeutic
  // sessions, and seasonal exhibitions. Daily because the calendar rolls
  // forward each day. Card images are 100x100 thumbnails; pipeline falls
  // through to og:image on the program detail page.
  {
    id: "denver-botanic-gardens-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://www.botanicgardens.org/calendar",
    selectors: {
      item: ".node--type-program-instance",
      title: "h3",
      date: ".program-date",
      description: ".node--type-program-instance",
      link: "a",
      image: "img",
    },
    defaultVenueSlug: "denver-botanic-gardens",
  },

  // ── McGregor Square — mixed-use development next to Coors Field
  // (Rockies). WordPress + The Events Calendar plugin (Tribe Events) —
  // month-view page renders 17 server-side `.tribe-events-calendar-
  // month__calendar-event-tooltip` cards with title + date + description.
  // Programming spans Avalanche/NBA watch parties, La Loma Tequila
  // Tuesdays, Mercado markets, Yappy Hours.
  {
    id: "mcgregor-square-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.mcgregorsquare.com/events/",
    selectors: {
      item: ".tribe-events-calendar-month__calendar-event-tooltip",
      title: "a",
      date: ".tribe-event-date-start",
      description: ".tribe-events-calendar-month__calendar-event-tooltip",
      link: "a",
      image: "img",
    },
  },

  // ── Dairy Block — mixed-use development (LoDo alley) with shops,
  // restaurants, and rotating programming (Geeks Who Drink trivia,
  // Thursday Jazz, etc.). WordPress + The Events Calendar plugin, server-
  // rendered `.event_list_tile` cards (16 visible). Card images are tiny
  // category SVG icons; the pipeline falls through to og:image on the
  // event detail page for a real hero. Daily because their programming is
  // very recurring (weekly trivia, jazz, etc.) and the date shifts.
  {
    id: "dairy-block-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://dairyblock.com/events/",
    selectors: {
      item: ".event_list_tile",
      title: ".title, h2",
      description: ".event_list_tile",
      link: 'a[href*="/events/"]',
      image: "img",
    },
  },

  // ── Denver Union Station — historic train hall + Crawford Hotel +
  // restaurants. Homepage carousel renders 8 server-side .card--events
  // tiles (their /experience/event-calendar/ page is JS-rendered and
  // empty in static HTML, so the homepage is the better target). WP
  // image URLs use -WxH suffixes that stripWpResize promotes to
  // originals. Mix of one-off + recurring weekly events (Champagne
  // Thursdays, Urban Markets).
  {
    id: "denver-union-station-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denverunionstation.com/",
    selectors: {
      item: ".card--events",
      title: ".card__heading",
      date: ".card__date",
      description: ".card__content",
      link: "a",
      image: "img",
    },
  },

  // ── LoDo Love (lodolove.com) — Lower Downtown neighborhood association
  // events calendar. Same CityKit tourism-board template as RiNo Art
  // District, so identical `.evcard` selectors. 61 events across the
  // neighborhood (Curtis Hotel, The Study, The Maven, etc.). cheerioWeb
  // rewrites the CityKit CDN URLs to landscape so the LLM image pipeline
  // can use the real photos instead of falling through to AI gen.
  {
    id: "lodo-love-events",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://lodolove.com/events/calendar",
    selectors: {
      item: ".evcard",
      title: ".evcard-content-headline",
      description: ".evcard-content",
      date: ".evcard-date-box",
      image: ".evcard-image-image",
    },
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

  // ── The Junkyard (thejunkyard.com) — Denver club / live-music venue.
  // The /shows page is a Next.js SPA but server-inlines full schema.org
  // MusicEvent JSON-LD per show, with images from Ticketmaster's CDN.
  // Same shape as the Ticketmaster/Eventbrite scrapes — jsonLdEvents
  // picks them up cleanly. Daily because shows roll on quickly.
  {
    id: "junkyard-denver-events",
    enabled: true,
    connector: "jsonLdEvents",
    cadence: "daily",
    sourceLabel: "Website",
    url: "https://www.thejunkyard.com/shows",
    defaultCategory: "Music",
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
    // Denver Art Society — Santa Fe Arts District nonprofit. IG
    // complements the 4 recurring event pages on the website; catches
    // exhibit openings, member art shows, and one-off arts programming.
    id: "denver-art-society-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "_denver_art_society",
    defaultCategory: "Arts & Culture",
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
    // Denver Summit FC — NWSL women's pro soccer team. Website schedule
    // is server-rendered but the LLM normalizer rejects most card text
    // as too-noisy (broadcast info + ticket links overpower the event
    // signal). IG is the better signal for fan-facing programming —
    // game-day rallies, watch parties, themed nights (Pride Night).
    id: "denver-summit-fc-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denversummit_fc",
    defaultCategory: "Sports",
  },
  {
    // Colorado Avalanche — NHL team, plays at Ball Arena. The IG account
    // posts game-day announcements, promotional events (Pucks & Pints,
    // Stanley Cup runs) and watch parties — useful complement to the
    // Ball Arena scrape. Defaults to ball-arena venue + Sports category.
    id: "colorado-avalanche-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "coloradoavalanche",
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
  },
  {
    // Denver Arts & Venues — city agency IG complements their portfolio
    // events page. Catches civic art programming (Civic Center EATS, art
    // installations, McNichols events) and grant-funded community events
    // the umbrella page sometimes underweights.
    id: "denver-arts-venues-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denverarts",
  },
  {
    // Larimer Square — IG complements the Squarespace events list.
    // Catches block-party announcements, tenant pop-ups, and seasonal
    // programming the events page doesn't always surface ahead of time.
    id: "larimer-square-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "larimersquare",
  },
  {
    // Denver Botanic Gardens — IG complements the Drupal calendar.
    // Catches special exhibitions, garden openings, member-only events,
    // and ad-hoc programming the calendar doesn't always preview.
    id: "denver-botanic-gardens-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denverbotanic",
    defaultVenueSlug: "denver-botanic-gardens",
  },
  {
    // McGregor Square Food & Drink — sub-account for restaurant/bar
    // programming (Tequila Tuesdays, Yappy Hours, brunch specials, wine
    // dinners). Complements the main @mcgregor_square account.
    id: "mcgregor-square-food-drink-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "mcgregorsquare_foodanddrink",
    defaultCategory: "Food & Drink",
  },
  {
    // McGregor Square — IG complements the Tribe Events calendar.
    // Catches Rockies game-day announcements, Mercado pop-ups, watch-
    // party schedules and seasonal programming the WP calendar lags on.
    id: "mcgregor-square-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "mcgregor_square",
  },
  {
    // Dairy Block — IG complements the .event_list_tile scrape. Catches
    // alley pop-ups, tenant-specific deals, and one-off block events the
    // events page doesn't always list.
    id: "dairy-block-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "dairyblock",
  },
  {
    // Denver Union Station — IG complements the .card--events scrape.
    // Catches tenant-restaurant pop-ups, hotel happenings, and one-off
    // events that don't make the homepage carousel.
    id: "denver-union-station-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denverunionstation",
  },
  {
    // Comedy Works — IG complements the .comedian-box scrape. Catches
    // last-minute drop-ins, member-only nights, and Comedy Works Foundation
    // events that don't always make the public /events page.
    id: "comedy-works-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "comedyworksdenver",
    defaultVenueSlug: "comedy-works",
    defaultCategory: "Comedy",
  },
  {
    // Denver Zoo — IG complements the website (which covers 7 marquee
    // events). The handle posts conservation events, member nights,
    // animal birthdays, lecture series, and adult-only nights that don't
    // always make the public things-to-do filter.
    id: "denver-zoo-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "denverzoo",
    defaultVenueSlug: "denver-zoo",
  },
  {
    // Downtown Aquarium Denver — IG-only because their Unbounce landing
    // page is fully JS-hydrated (every <img> is a 1x1 placeholder in the
    // static HTML; titles/dates only render at runtime). IG catches their
    // event programming — Yoga at the Aquarium, holiday specials,
    // promo nights, restaurant events.
    id: "downtown-aquarium-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "aquariumdenver",
    defaultVenueSlug: "downtown-aquarium",
  },
  {
    // Goldfinch Denver — Denver hospitality account. Worth a try as a
    // single-handle IG source; if it produces good event signal we keep
    // it, otherwise disable.
    id: "goldfinch-denver-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "goldfinchdenver",
  },
  {
    // Snarf's Sandwiches — Denver-born sandwich chain. Website is just
    // menu + location finder; IG catches sandwich-contest finalists,
    // limited-time menu items, and location-specific events.
    id: "snarfs-sandwiches-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "snarfssandwiches",
    defaultCategory: "Food & Drink",
  },
  {
    // Cherry Cricket — iconic Denver burger restaurant (Cherry Creek,
    // Downtown, Littleton, Broomfield). Website /news/events is just old
    // marketing posts; IG is where specials, anniversary nights, and
    // collaborations get announced.
    id: "cherry-cricket-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "thecherrycricket",
    defaultCategory: "Food & Drink",
  },
  {
    // Outside Pizza — Denver Highlands pop-up pizza shop. Website is just
    // hours + address, but IG catches their brewery collabs, pop-ups, and
    // special pairings (already seen "Outside Pizza Grand Opening at
    // Cerebral" come through cross-source). Food-only account so should
    // dodge the alcohol age-gate that hits brewery IGs.
    id: "outside-pizza-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "outsidepizza",
    defaultCategory: "Food & Drink",
  },
  {
    // Westbound & Down Brewing Co — the brewing company's main IG.
    // Distinct from @westbound_denver (the bar location). May hit IG's
    // age-gate as a pure brewery account; first run confirms.
    id: "westbound-and-down-brewing-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "westboundanddownbrewingco",
  },
  {
    // Westbound — Denver bar/restaurant. IG handle uses underscore;
    // worth a try given RiNo Beer Garden's bar-and-restaurant account
    // dodged the age-gate that pure breweries hit.
    id: "westbound-denver-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "westbound_denver",
  },
  {
    // Station 26 Brewing — North Park Hill brewery. Disabled because
    // Instagram age-gates the profile (confirmed: "Restricted profile"
    // in Apify log, 0 posts). Fifth alcohol account in a row hit by
    // this gate; consistent pattern for pure-brewery IGs.
    id: "station-26-brewing-ig",
    enabled: false,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "s26bc",
  },
  {
    // RiNo Beer Garden — RiNo neighborhood beer garden + restaurant.
    // Will likely hit the IG age-gate (pattern is 4-for-4 for alcohol
    // accounts: denverbeerco, cerebralbrewing, spirithounddistillers,
    // greatdividebrew). First run confirms.
    id: "rino-beer-garden-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "rinobeergarden",
  },
  {
    // Great Divide Brewing — RiNo brewery. Disabled because Instagram
    // age-gates the profile (confirmed: "Restricted profile" in Apify
    // log, 0 posts). Same pattern as @denverbeerco, @cerebralbrewing,
    // @spirithounddistillers — fourth in a row, so we've fully confirmed
    // the pattern. All brewery/distillery IG accounts need session-
    // cookie auth to scrape.
    id: "great-divide-ig",
    enabled: false,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "greatdividebrew",
    defaultVenueSlug: "great-divide-brewing",
  },
  {
    // Spirit Hound Distillers — Lyons-based distillery. Disabled because
    // Instagram age-gates the profile as alcohol-related content
    // (confirmed: "Restricted profile" in the Apify log, 0 posts
    // returned). Same pattern as @denverbeerco and @cerebralbrewing.
    // Also: Lyons is ~50min outside Denver, so this is borderline for
    // /explore coverage even if we could scrape it.
    id: "spirit-hound-distillers-ig",
    enabled: false,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "spirithounddistillers",
  },
  {
    // Cerebral West Highland — secondary Cerebral location. May or may
    // not hit the same age-gate as the main @cerebralbrewing account;
    // first run will tell us.
    id: "cerebral-west-highland-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "cerebral.westhighland",
  },
  {
    // Cerebral Brewing — RiNo-area craft brewery. Disabled because
    // Instagram age-gates the profile as alcohol-related content and
    // Apify's unauthenticated scraper returns 0 posts (same pattern as
    // denverbeerco-ig). Keep config for future session-cookie support.
    id: "cerebral-brewing-ig",
    enabled: false,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "cerebralbrewing",
  },
  {
    // The Junkyard — Denver live-music club. IG catches lineup teases,
    // afterparties, and special programming before they hit the
    // schema.org-LD feed on /shows.
    id: "junkyard-denver-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "junkyarddenver",
    defaultCategory: "Music",
  },
  {
    // Paramount Theatre Denver — historic Downtown theatre. IG catches
    // tour announcements, on-sale dates, and special programming before
    // they hit the Ticketmaster widget. KSE-owned venue alongside Ball
    // Arena.
    id: "paramount-denver-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "paramountdenver",
    defaultVenueSlug: "paramount-theatre",
  },
  {
    // Ball Arena — Denver's marquee indoor venue. Website covers the full
    // 87-event calendar; IG catches lineup teases, last-minute additions,
    // and special events before they hit /misc/all-events.
    id: "ball-arena-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "ballarenadenver",
    defaultVenueSlug: "ball-arena",
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
    // RiNo Street Fair — annual one-day fair (May). The website is mostly
    // useful around fair-time; IG posts year-round content (announcement
    // teases, vendor highlights, recap posts). Likely produces 1-2 dated
    // events per year (the fair itself); useful as a marker source.
    id: "rino-street-fair-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "rinostreetfair",
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
