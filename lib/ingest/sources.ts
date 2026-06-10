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
    // Disabled: rinobeergarden.com is a WordPress restaurant site (About / Menu /
    // Brunch / Banquet) with no events page, no event post-type, and no feed —
    // wp-json is 403-blocked and the Yoast sitemap lists only post/page sitemaps.
    // The beer garden's events (trivia, live music, brunch) live on Instagram,
    // covered by rino-beer-garden-ig below. Kept here (disabled) to document the
    // investigation so the website isn't re-added as a source.
    id: "rino-beer-garden-web",
    enabled: false,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://rinobeergarden.com/",
    defaultVenueSlug: "rino-beer-garden",
    defaultCategory: "Food & Drink",
  },
  {
    // Disabled: a 30-post inspection ingest surfaced only recurring menu specials
    // and promos — "Taco Tuesday", "Happy Hour", "Lunch Special Cheese Burger
    // $10.95", "Bottomless Mimosas Brunch", "Pints & Pies Deal" — not discrete,
    // discovery-worthy events (the lone real one was a "Playoff Hockey" watch
    // party). It's a food/lifestyle feed, so it pollutes listings with weekly
    // specials. Left here (disabled) to document the inspection so it isn't
    // re-added (cf. lodo-love-ig, colorado-avalanche-ig). The website has no
    // events either (rino-beer-garden-web above), so this venue has no good
    // source for now.
    id: "rino-beer-garden-ig",
    enabled: false,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "rinobeergarden",
    defaultVenueSlug: "rino-beer-garden",
    defaultCategory: "Food & Drink",
  },
  {
    // Disabled: rinostreetfair.com/schedule (WordPress/Elementor, UAEL post grid
    // — statically scrapeable) is the program of a single ANNUAL one-day festival
    // (RiNo Street Fair, May 9). Two problems make it a poor dedicated source:
    // (1) the schedule is only ever the lineup for that one day, so outside the
    // event window it's all past-dated and yields zero upcoming listings; and
    // (2) the items are sub-activities (individual band sets, "Shopping all day",
    // "Food trucks all day", pop-up pickleball), not standalone discoverable
    // events — the discoverable thing is the single "RiNo Street Fair" listing.
    // That fair-as-one-event is already caught when upcoming by the aggregators
    // (rino-art-district-web, visit-denver-web, the SerpAPI markets/outdoor
    // queries), same pattern as the Highlands Street Fair via highlands-square-web.
    id: "rino-street-fair-web",
    enabled: false,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://rinostreetfair.com/schedule/",
    defaultCategory: "Markets",
  },
  {
    // Disabled: goldfinchdenver.com sits behind a Cloudflare JS challenge (every
    // page 403s a plain fetch), so the free connectors can't read it — only Apify
    // with JS rendering could, at cost. And the events calendar is overwhelmingly
    // recurring bar specials ("Exclusive Bar Takeover" daily, Breakfast Club,
    // Live Music Wednesday, Movies/Tinis/Tacos, Neighborhood Night, Thursday
    // Specialty) with only the rare one-off (Signal Surrender, Night Shift Pride)
    // — same low signal-to-noise as rino-beer-garden. Not worth the Apify spend;
    // its notable events arrive via Visit Denver / SerpAPI / Arts & Venues.
    id: "goldfinch-denver-web",
    enabled: false,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.goldfinchdenver.com/events",
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
    // Paramount Theatre (downtown, 1621 Glenarm) — its event-calendar page is a
    // client-side Ticketmaster widget (TMEventWidget.js) that fetches the KSE
    // proxy's Discovery API venue feed: alttix.ksehq.com/api/tm/venue/<id> (same
    // host as ball-arena-web, different endpoint shape). The ticketmasterVenue
    // connector reads it directly — 70 richly-structured events with real art,
    // exact showtimes, and TM classifications. Feed is venue-scoped, so pin via
    // defaultVenueSlug. Mixed Music / Arts & Theatre / Film lineup, so category
    // is left per-event (the connector passes the TM classification to the
    // normalizer); no defaultCategory.
    id: "paramount-theatre-web",
    enabled: true,
    connector: "ticketmasterVenue",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://alttix.ksehq.com/api/tm/venue/KovZpZAFa1nA",
    maxItems: 60,
    defaultVenueSlug: "paramount-theatre",
  },
  {
    // The Junkyard (Live Nation amphitheatre in Sun Valley) embeds its full show
    // list as schema.org JSON-LD MusicEvent blocks on /shows — clean tz-aware
    // startDates, Ticketmaster art, ticket links — so the generic jsonLdEvents
    // connector reads them directly (no card scraping, no month iteration; the
    // list page carries every upcoming show). Single venue, pin via
    // defaultVenueSlug. All-music lineup, so defaultCategory Music.
    id: "the-junkyard-web",
    enabled: true,
    connector: "jsonLdEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.thejunkyard.com/shows",
    maxItems: 60,
    defaultVenueSlug: "junkyard",
    defaultCategory: "Music",
  },
  {
    id: "cerebral-brewing-web",
    enabled: true,
    // WordPress `event` post-type archive, server-rendered — the homepage
    // apifyWeb scrape surfaced ~nothing, but /events/ lists every upcoming show
    // as a static .excerpt-box.event card that in-process cheerio (free) parses
    // cleanly. The date span carries the taproom (Congress Park / Aurora Arts /
    // West Highland); all are Cerebral, so they stay pinned to the one venue.
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://cerebralbrewing.com/events/",
    selectors: {
      item: ".excerpt-box.event",
      title: ".excerpt-box-title",
      date: ".excerpt-box-date",
      image: "img.image",
    },
    maxItems: 40,
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
  {
    // West Highland taproom's own account — a genuinely event-rich feed (trivia,
    // run club, drag brunch/bingo, Pitch-a-Friend, fundraisers), distinct from
    // the main @cerebralbrewing account. Pins to the West Highland venue
    // (seeded in 20260604180000_cerebral_west_highland_venue.sql), ~3 miles from
    // the Congress Park original, so these don't mis-pin on the map.
    id: "cerebral-west-highland-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "cerebral.westhighland",
    defaultVenueSlug: "cerebral-west-highland",
    defaultCategory: "Food & Drink",
  },
  {
    // Downtown Aquarium's full-year calendar.asp (Landry's). A custom connector
    // attaches month-header dates, decodes the page's Windows-1252 bytes, and
    // filters out the ~65% of entries that are repetitive program/camp
    // registrations — keeping only the discoverable special events (animal-
    // awareness days, Wine Fest, Witches Tea, holiday dinners). The sibling
    // promos.aquariumrestaurants.com landing page is image-only and just links
    // back to this calendar, so it's intentionally not a separate source.
    // Category is left per-event (animal days vs Wine Fest vs dinners differ).
    id: "downtown-aquarium-web",
    enabled: true,
    connector: "aquariumCalendar",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.aquariumrestaurants.com/downtownaquariumdenver/calendar.asp",
    maxItems: 40,
    defaultVenueSlug: "downtown-aquarium",
  },
  {
    // Denver Zoo runs on a JS-heavy WordPress theme, but its events live in a
    // clean "atomic-event" custom post type exposed via the wp-json REST API —
    // far better than scraping the rendered page. The connector builds blobs
    // from each post's title + excerpt + the date parsed from the body. Per-
    // event category varies (animal birthdays vs Zoo Lights vs adult nights),
    // so it's left to the normalizer.
    id: "denver-zoo-web",
    enabled: true,
    connector: "wpRestEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denverzoo.org/wp-json/wp/v2/atomic-event",
    maxItems: 40,
    defaultVenueSlug: "denver-zoo",
  },
  {
    // Denver Union Station's /experience/event-calendar/ is JS-rendered with no
    // events REST collection, but it's a WordPress site whose events-sitemap.xml
    // lists every server-rendered event detail page (clean OG title/description/
    // image + the dates in the body). The connector reads the sitemap, scrapes
    // each page, and emits the soonest upcoming events. Category varies (public
    // event / family-kids / 21+), so it's left to the normalizer.
    id: "denver-union-station-web",
    enabled: true,
    connector: "denverUnionStation",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denverunionstation.com/events-sitemap.xml",
    maxItems: 40,
    defaultVenueSlug: "denver-union-station",
  },
  {
    // Larimer Square (historic LoDo block) runs its calendar on Squarespace,
    // which serves the whole event collection as JSON at ?format=json with a
    // pre-filtered `upcoming` array. The generic squarespaceEvents connector
    // reads it directly. Events span the block's restaurants/bars, so per-event
    // venue/category is left to the normalizer; all pin to Larimer Square.
    id: "larimer-square-web",
    enabled: true,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.larimersquare.com/events",
    maxItems: 40,
    defaultVenueName: "Larimer Square",
    defaultVenueSlug: "larimer-square",
  },
  {
    // Disabled: Station 26's Squarespace ?format=json feed is reachable, but a
    // trial ingest surfaced only thin recurring content — the sole survivors were
    // a weekly "Sunset Sessions" live-music series (the Monday cornhole league
    // and a "registration deadline" were correctly filtered as non-events). Those
    // sessions are at the sibling "The Outpost on Platte", whose name varies per
    // feed item, so multi-venue resolution scatters them across several duplicate
    // venue pins. Low signal for the noise; its notable events arrive via Visit
    // Denver / SerpAPI. (Connector: squarespaceEvents, same as larimer-square-web.)
    id: "station-26-brewing-web",
    enabled: false,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.station26brewing.co/events",
    maxItems: 40,
  },
  {
    // Disabled: citymud.com/events is a Squarespace *products* collection
    // (workshops sold as commerce items), not an events calendar — the
    // ?format=json `upcoming` events array is empty, so squarespaceEvents finds
    // nothing. It currently holds a single workshop product with its dates baked
    // into the title text ("...June 13 & July 11"), not structured fields.
    // Reading it would need a products connector + LLM date extraction for ~1
    // item — not worth it. (Apothecary workshops, niche; rare for discovery.)
    id: "city-mud-web",
    enabled: false,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.citymud.com/events",
    maxItems: 40,
  },
  {
    // Disabled: junglerumbar.com (Squarespace tiki bar) has no events — /events
    // 404s, the nav is menus + private-event rentals, and JSON-LD is just
    // WebSite/LocalBusiness. The only "deal" is a generic everyday happy hour
    // ("4-6 Everyday & 9-11 Tue+Wed") with no specifics — true of nearly every
    // bar, not a discoverable dated deal. Nothing structured to ingest.
    id: "jungle-rum-bar-web",
    enabled: false,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://junglerumbar.com/events",
    maxItems: 40,
  },
  {
    // Dairy Block (LoDo micro-district) runs The Events Calendar (Tribe) on
    // WordPress; its JS calendar is backed by a clean REST API at
    // /wp-json/tribe/events/v1/events. The generic tribeEvents connector reads
    // it directly. It's a multi-venue aggregator — events carry their own real
    // sub-venue (Seven Grand, Kachina Cantina, Denver Milk Market…) with full
    // addresses — so no defaultVenueSlug: resolveOrCreateVenue() pins each event
    // to its actual venue (the seeded dairy-block row stays as a district pin).
    id: "dairy-block-web",
    enabled: true,
    connector: "tribeEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://dairyblock.com/events/",
    maxItems: 40,
  },
  {
    // Denver Botanic Gardens runs a Drupal 10 calendar that server-renders event
    // cards and paginates with ?page=N (no JS/API). The botanicGardensCalendar
    // connector reads the chronological list, dedupes recurring programs to the
    // soonest instance, and pulls title/description/image from each program's
    // detail-page OG tags. Multi-location (York Street + Chatfield Farms), so no
    // defaultVenueSlug — the card's location badge maps to the right venue.
    id: "denver-botanic-gardens-web",
    enabled: true,
    connector: "botanicGardensCalendar",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.botanicgardens.org/calendar",
    maxItems: 40,
  },
  {
    // Denver Arts & Venues aggregates events across the city's venues (Red Rocks,
    // Buell/DPAC, Bellco, McNichols, Denver Coliseum…). The /events page is
    // flaky to scrape (JS-rendered), but it publishes a clean ev:-namespace RSS
    // feed (350+ events with start/end/location/type). The generic eventRssFeed
    // connector reads it; dates are UTC → localized to Denver. Multi-venue
    // aggregator, so no defaultVenueSlug (per-event venue resolves by name).
    id: "denver-arts-venues-web",
    enabled: true,
    connector: "eventRssFeed",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.artsandvenuesdenver.com/events/rss",
    maxItems: 40,
  },
  {
    // McGregor Square (the plaza beside Coors Field in LoDo) runs The Events
    // Calendar (Tribe) — concerts, watch parties, markets, movie nights. Every
    // event is at the one plaza, so pin them via defaultVenueSlug. Reuses the
    // generic tribeEvents connector (its REST API is at /wp-json/tribe/...).
    id: "mcgregor-square-web",
    enabled: true,
    connector: "tribeEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.mcgregorsquare.com/events/",
    maxItems: 40,
    defaultVenueSlug: "mcgregor-square",
  },
  {
    // Denver Summit FC (NWSL) server-renders its schedule with Home/Away match
    // cards. The connector keeps only HOME matches (at DICK'S Sporting Goods
    // Park, Commerce City) — away games aren't local — and pins them there.
    id: "denver-summit-fc-web",
    enabled: true,
    connector: "denverSummitFcSchedule",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denversummitfc.com/schedule/",
    maxItems: 30,
    defaultVenueSlug: "dick-s-sporting-goods-park",
    defaultCategory: "Sports",
  },
  {
    // Denver Art Society (artist collective in the Santa Fe Arts District) runs
    // a Wix Events widget; the existing wixEvents connector reads its embedded
    // warmup-data. Single venue, so pin via defaultVenueSlug.
    id: "denver-art-society-web",
    enabled: true,
    connector: "wixEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denverartsociety.org/",
    maxItems: 40,
    defaultVenueSlug: "denver-art-society",
  },
  {
    // Colorado Convention Center (Legends/ASM-managed) server-renders its
    // /events list as static Bootstrap cards — no JS, API, or feed needed, so
    // in-process cheerio (free) parses them directly. Cards are date-ordered
    // soonest-first; one page covers the upcoming batch (maxItems caps it). The
    // date <li> is selected by its calendar icon (`li:has(.fa-calendar-day)`,
    // distinct from the location <li>). Every event is at the one downtown
    // venue, so pin via defaultVenueSlug. Note: some CCC shows also arrive via
    // the Denver Arts & Venues RSS feed (denver-arts-venues-web), which resolves
    // "Colorado Convention Center" by name to this same seeded venue
    // (20260609150000_colorado_convention_center_venue.sql) — downstream dedup
    // handles any overlap.
    id: "colorado-convention-center-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denverconvention.com/events/",
    selectors: {
      item: ".card.border-0.shadow",
      title: "h5.card-title",
      date: "li:has(.fa-calendar-day)",
      link: "a.stretched-link",
      image: "img.bg-white",
    },
    maxItems: 40,
    defaultVenueSlug: "colorado-convention-center",
  },
  // Comedy Works runs two Denver clubs (Downtown in LoDo, South in Greenwood
  // Village) off one Rails calendar that pages a month per URL and interleaves
  // both clubs plus external "concerts". A custom connector crawls the current
  // month + the next few, follows each show's /comedians/<slug> page for its
  // showtimes, price, address and description, and emits one item per show-date.
  // One source per club: `comedyWorksClub` filters the shared calendar so each
  // pins authoritatively via its defaultVenueSlug (see
  // 20260604210000_comedy_works_venues.sql) instead of relying on LLM venue
  // extraction. Category is Comedy for both.
  {
    id: "comedy-works-downtown-web",
    enabled: true,
    connector: "comedyWorksCalendar",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://comedyworks.com/shows/calendar",
    comedyWorksClub: "downtown",
    monthsAhead: 3,
    maxItems: 40,
    defaultVenueSlug: "comedy-works-downtown",
    defaultCategory: "Comedy",
  },
  {
    id: "comedy-works-south-web",
    enabled: true,
    connector: "comedyWorksCalendar",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://comedyworks.com/shows/calendar",
    comedyWorksClub: "south",
    monthsAhead: 3,
    maxItems: 40,
    defaultVenueSlug: "comedy-works-south",
    defaultCategory: "Comedy",
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
    // denverbroncos.com is a heavy SPA; pull the schedule from ESPN's public
    // NFL feed instead (future home games at Empower Field only). ESPN's default
    // team endpoint serves the upcoming season, so it returns nothing in the
    // offseason gap and advances when the next schedule publishes. `url` is the
    // human-facing link the connector attaches to each game.
    connector: "nflSchedule",
    cadence: "weekly",
    sourceLabel: "Website",
    nflTeamAbbrev: "DEN",
    url: "https://www.denverbroncos.com/schedule/",
    maxItems: 60,
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
    // nba.com/nuggets is a heavy SPA; pull the schedule from NBA's public
    // data.nba.com feed instead (future home games at Ball Arena only). Returns
    // nothing in the offseason and auto-advances when the next season publishes.
    connector: "nbaSchedule",
    cadence: "weekly",
    sourceLabel: "Website",
    nbaTeamId: 1610612743,
    nbaTeamSlug: "nuggets",
    maxItems: 60,
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
    // nhl.com/avalanche is a heavy SPA; pull the schedule from NHL's public
    // api-web.nhle.com feed instead (future home games at Ball Arena only). The
    // /now endpoint auto-resolves the current season, so it returns nothing in
    // the offseason and advances when the next schedule publishes.
    connector: "nhlSchedule",
    cadence: "weekly",
    sourceLabel: "Website",
    nhlTeamAbbrev: "COL",
    nhlTeamSlug: "avalanche",
    maxItems: 60,
    defaultVenueSlug: "ball-arena",
    defaultCategory: "Sports",
  },
  {
    id: "colorado-avalanche-ig",
    // Disabled: @coloradoavalanche is a brand/news account (game hype, player
    // tributes, roster moves), not an event-posting one — a 12-post inspection
    // surfaced 0 upcoming datable events. The team's real events are its home
    // games, now pulled authoritatively from the NHL API (colorado-avalanche-web,
    // connector: "nhlSchedule"). Keeping this on would only risk duplicate game
    // listings (IG games carry sourceLabel "Instagram", so the per-label dedup
    // passes wouldn't match them against the API's "Website" rows) for ~0
    // net-new events. Theme nights still arrive via denver-sports-events
    // (SerpAPI) and ball-arena-web.
    enabled: false,
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
    // Denver Public Library runs Springshare LibCal. Its calendar renders from a
    // clean JSON endpoint (/ajax/calendar/list?c=-1&m=list&date=…), read by the
    // generic libcalEvents connector — mostly free family/community programming
    // (storytimes, MakerCamp, classes, book clubs) across ~26 branches, so no
    // defaultVenueSlug; each event resolves to its branch.
    id: "denver-public-library-web",
    enabled: true,
    connector: "libcalEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denverlibrary.libcal.com",
    maxItems: 40,
  },
  {
    // Denver Audubon's /calendar is a JS-rendered Duda page, but its events live
    // in NeonCRM, whose public eventList.jsp server-renders every program as a
    // static .neoncrm-event-* table row (name, date+time+MT tz, location, a
    // registration link). In-process cheerio (free) parses it directly. Bird
    // walks, birding field trips, and nature classes run at many outdoor
    // locations (Bear Creek Greenbelt, Barr Lake…), so no defaultVenueSlug —
    // resolveOrCreateVenue pins each from the location (titles also name it, e.g.
    // "...at Bear Creek Greenbelt"). description = the location field for venue
    // resolution.
    id: "denver-audubon-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denveraudubon.app.neoncrm.com/np/clients/denveraudubon/eventList.jsp",
    selectors: {
      item: "tr:has(.neoncrm-event-name)",
      title: ".neoncrm-event-name",
      date: ".neoncrm-event-date",
      description: ".neoncrm-event-location",
      link: "a",
      image: ".neoncrm-event-thumbnail img",
    },
    maxItems: 40,
  },
  {
    // Downtown Denver Partnership is a Wix CMS site whose events are a custom Wix
    // Data collection — not the Wix Events app (warmup data has no events) and
    // not cleanly selectable by class (Wix's generated comp-IDs). But Wix
    // server-renders the list, and each event card is a `[role=listitem]` with an
    // <h4> title, a real wixstatic image, and an /event/<slug> link. apifyWeb
    // grabs each card's full text (date/time/venue/title/description all live in
    // generic richTextElements, so the normalizer parses the blob). Static SSR,
    // so the cheap cheerio-scraper actor suffices — no renderJs browser needed.
    // Multi-venue (Sheraton, Civic Center, Sie FilmCenter…), so no defaultVenueSlug.
    id: "downtown-denver-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.downtowndenver.com/events",
    selectors: {
      item: "[role=listitem]:has(h4)",
      title: "h4",
    },
    maxItems: 40,
  },
  {
    // MCA Denver (Museum of Contemporary Art) runs a Craft CMS site that
    // server-renders its events; each card is a `.block-featured` div wrapping an
    // /events/<slug> anchor with a real Eventbrite poster. Titles/dates/venues
    // live in Tailwind utility divs (no stable per-field selectors), so apifyWeb
    // grabs each card's full text for the normalizer. Static SSR — cheap
    // cheerio-scraper actor, no renderJs. Events split between the MCA building
    // and its Holiday Theater, so no defaultVenueSlug.
    id: "mca-denver-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://mcadenver.org/events",
    selectors: {
      item: ".block-featured",
    },
    maxItems: 40,
  },
  {
    // Denver Bike Fest is a single annual festival on a one-page React promo site
    // (denverbikefest.app) — no events list. The event details are in the static
    // HTML, so apifyWeb with no item selector falls back to the whole-page text
    // and the normalizer extracts the one event (Denver Bike Fest at York Street
    // Yards). Single venue resolves from the text (no seed). Static — cheap
    // cheerio-scraper actor. Re-captures the next edition when the page updates.
    id: "denver-bike-fest-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denverbikefest.app/",
    defaultCategory: "Outdoor",
    maxItems: 5,
  },
  {
    // Lady Justice Brewing (queer-community brewery in Englewood) publishes its
    // events as an embedded public Google Calendar. The generic icsCalendar
    // connector reads the .ics feed directly — drag/queer nights, live music,
    // trivia, bingo, paint night — skipping recurring masters and "Closed …"
    // entries (food trucks still come through as Food & Drink). All at the one
    // taproom, so pin via defaultVenueSlug.
    id: "lady-justice-brewing-web",
    enabled: true,
    connector: "icsCalendar",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://calendar.google.com/calendar/ical/c_d08c98b40bd04ce35c8222d49209732d8851b1b493f0a722b0704a463b3db75b%40group.calendar.google.com/public/basic.ics",
    maxItems: 40,
    defaultVenueSlug: "lady-justice-brewing",
  },
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
