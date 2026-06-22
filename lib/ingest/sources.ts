import type { SourceConfig } from "./types";

// Curated-source scraping strategy — every source maps to a venue/organizer in
// the curated source sheet; there are no broad discovery queries.
// - Structured feeds (Squarespace/Wix/Tribe/ICS/JSON-LD/REST) parsed directly where a venue exposes one.
// - Apify Instagram for venues that post events to a handle.
// - cheerio / Apify Web for venues whose events live in server-rendered or JS-heavy HTML.
export const SOURCES: SourceConfig[] = [
  // ── Apify Instagram: per-account deep dives for venues we follow closely.
  {
    id: "mission-ballroom-web",
    // AEG/AXS venue: /upcoming-events embeds an AXS widget backed by a public
    // static events.json feed (auto-discovered from the page's data-file). Clean
    // JSON, no auth/JS — far better coverage than the Instagram feed below.
    enabled: true,
    connector: "aegEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://missionballroom.com/upcoming-events/",
    defaultVenueSlug: "mission-ballroom",
    defaultCategory: "Music",
    maxItems: 60,
  },
  {
    id: "mission-ballroom-ig",
    // Disabled: redundant with mission-ballroom-web (AEG feed), which is
    // cleaner and comprehensive; the IG just re-announces the same shows.
    enabled: false,
    connector: "instagram",
    cadence: "daily",
    sourceLabel: "Instagram",
    handle: "missionballroom",
    defaultVenueSlug: "mission-ballroom",
    defaultCategory: "Music",
  },
  {
    // Coffee roaster (Five Points, Wynkoop, Aurora, W Cedar roastery). IG posts
    // real events — Pride/vendor markets, monthly Cowpoke Friday hangs, ticketed
    // cupping workshops, guest-barista takeovers — among shop updates the
    // normalizer filters. Multi-location, so venue resolves per post.
    id: "queen-city-coffee-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "queencitycoffee",
    defaultVenueName: "Queen City Coffee",
    defaultCategory: "Food & Drink",
  },
  {
    // Denver Central Market — RiNo food hall. IG posts real events (ticketed
    // Book Swaps, the recurring free RiNo Movie Nights at The Lot on Larimer,
    // Pride parties) among heavy vendor/menu marketing the normalizer filters.
    // Venue resolves per post (some events are offsite).
    id: "denver-central-market-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "dencentralmkt",
    defaultVenueName: "Denver Central Market",
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
    // (rino-art-district-web, visit-denver-web, denver-arts-venues-web), same
    // pattern as the Highlands Street Fair via highlands-square-web.
    id: "rino-street-fair-web",
    enabled: false,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://rinostreetfair.com/schedule/",
    defaultCategory: "Markets",
  },
  {
    id: "goldfinch-denver-web",
    // PopMenu venue behind a Cloudflare JS challenge: the popmenuEvents
    // connector drives it with a browser over a residential proxy (clears the
    // challenge) and reads the event cards. Recurring bar nights (Live Music
    // Wednesday, Open Mic, Sunday Sessions) now ingest as recurring listings.
    enabled: true,
    connector: "popmenuEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.goldfinchdenver.com/events",
    defaultVenueName: "The Goldfinch",
    defaultCategory: "Food & Drink",
    maxItems: 40,
  },
  {
    id: "denver-museum-nature-science-web",
    // dmns.org/purchase/tickets is a Blazor Server app whose ticketing backend
    // blocks datacenter IPs — no HTML/JSON/feed. The dmnsEvents connector drives
    // it with a real browser over a residential proxy: clicks the Events tab and
    // reads the rendered cards. Slow (~1 min) but weekly. Venue-pinned below.
    enabled: true,
    connector: "dmnsEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.dmns.org/purchase/tickets/?category=events",
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
    // Posts monthly roundup captions listing several events at once.
    multiEvent: true,
  },
  {
    // Outside Pizza — independent pizzeria operating out of Cerebral's West
    // Highland kitchen. Mostly menu/brand posts, but a few real events surface
    // (Drag Brunch, off-site Gozney pop-ups). Caption-based: the event detail is
    // in the text, no flyer to OCR, and the normalizer drops the menu posts.
    // Pinned to its home venue so location-less captions map correctly; an
    // off-site pop-up (e.g. RiNo) overrides via the LLM-extracted venue, and any
    // event it shares with the West Highland account dedups on title+venue+day.
    id: "outside-pizza-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: "outsidepizza",
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
    // New Terrain Brewing (Golden) runs a Squarespace events collection in
    // calendar mode, so ?format=json returns the month's events in `items`
    // (past + future) rather than the pre-filtered `upcoming` — the connector
    // falls back to `items`. Event-rich: live music (Music by the Mesa), World
    // Cup watch parties, Bike Demo Days, yoga, book clubs. Single venue, pinned.
    id: "new-terrain-brewing-web",
    enabled: true,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://newterrainbrewing.com/events",
    maxItems: 40,
    defaultVenueName: "New Terrain Brewing Co",
    defaultVenueSlug: "new-terrain-brewing",
  },
  {
    // The Jasmine Bar (downtown Louisville) runs a Squarespace events collection —
    // its courtyard "Summer Concert Series" lists ~23 named live-music nights.
    // squarespaceEvents reads the ?format=json upcoming feed; single venue, pinned.
    id: "jasmine-bar-web",
    enabled: true,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.thejasminebar.com/events",
    maxItems: 40,
    defaultVenueName: "The Jasmine Bar",
    defaultVenueSlug: "the-jasmine-bar",
    defaultCategory: "Music",
  },
  {
    // Avery Brewing (Gunbarrel, Boulder) is a Next.js site whose taproom events
    // live only in __NEXT_DATA__ (a Strapi taproom-events component), read by the
    // averyTaproomEvents connector. Recurring weekly series (trivia, yoga, Magic,
    // board games) plus one-offs (World Cup watch parties, the 4K on 4th race);
    // dates are recurrence strings the normalizer resolves. Single venue, pinned.
    id: "avery-brewing-web",
    enabled: true,
    connector: "averyTaproomEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.averybrewing.com/taproom-events",
    maxItems: 20,
    defaultVenueSlug: "avery-brewing",
  },
  {
    // Gothic Theatre (Englewood, AEG venue). The /calendar AXS widget loads its
    // events from a public static JSON feed (data-file events.json) — same
    // pattern as Mission Ballroom — so aegEvents reads the page, follows the
    // feed, and maps clean structured shows (title, ISO date, support acts,
    // ticket art). No browser/Apify needed; far cheaper and more reliable than
    // the prior renderJs scrape, and the feed carries the date the normalizer
    // needs. Single venue, pinned.
    id: "gothic-theatre-web",
    enabled: true,
    connector: "aegEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://gothictheatre.com/calendar/",
    maxItems: 60,
    defaultVenueSlug: "gothic-theatre",
    defaultCategory: "Music",
  },
  {
    // Disabled: Station 26's Squarespace ?format=json feed is reachable, but a
    // trial ingest surfaced only thin recurring content — the sole survivors were
    // a weekly "Sunset Sessions" live-music series (the Monday cornhole league
    // and a "registration deadline" were correctly filtered as non-events). Those
    // sessions are at the sibling "The Outpost on Platte", whose name varies per
    // feed item, so multi-venue resolution scatters them across several duplicate
    // venue pins. Low signal for the noise; its notable events arrive via Visit
    // Denver. (Connector: squarespaceEvents, same as larimer-square-web.)
    id: "station-26-brewing-web",
    enabled: false,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.station26brewing.co/events",
    maxItems: 40,
  },
  {
    // Squarespace *products* collection: pottery classes sold as commerce items
    // with dates in variant attributes ("July 3rd"). The squarespaceProducts
    // connector reads /events?format=json and emits one listing per dated variant
    // (skips non-dated merch). Low volume but real class events.
    id: "city-mud-web",
    enabled: true,
    connector: "squarespaceProducts",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.citymud.com/events",
    defaultVenueName: "City Mud",
    defaultCategory: "Arts & Culture",
    maxItems: 40,
  },
  {
    // Events live only in a monthly flyer image on the homepage (no text/feed;
    // captionless IG). The flyerImage connector sends the page's images to the
    // vision model to read the calendar (Drag Bingo, Live Jazz Weds, Tea Dance).
    id: "jungle-rum-bar-web",
    enabled: true,
    connector: "flyerImage",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://junglerumbar.com/",
    defaultVenueName: "Jungle Rum Bar",
    defaultCategory: "Food & Drink",
    maxImages: 6,
    maxItems: 40,
  },
  {
    // Events are a Canva-designed month grid embedded via a GoDaddy widget
    // (GoDaddy iframe -> Canva embed -> <canvas>): no text, feed, API, fetchable
    // image, or DOM links (the 'Learn More' buttons are Canva element-links).
    // The screenshotVision connector screenshots the rendered Canva embed and
    // vision-OCRs it. The Canva embed URL is auto-discovered from the events page
    // each run, so a new monthly design is picked up automatically.
    id: "waldschanke-ciders-web",
    enabled: true,
    connector: "screenshotVision",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://waldschankeciders.com/events",
    defaultVenueName: "Waldschänke Ciders",
    defaultCategory: "Food & Drink",
    waitForTimeoutMs: 15000,
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
    // Schoolyard Beer Garden (single venue) runs WordPress + The Events Calendar;
    // tribeEvents reads its /wp-json/tribe/events REST. Real events (Trivia,
    // Vintage Pop Up, book club, Day Camp Wellness, Dog Days of Summer) mixed with
    // recurring drink specials (Wine Down Wednesdays, Happy Hour, Tuesday Rita)
    // the normalizer filters as non-events. Venue already exists (auto-created
    // from the pottery product); pin to it.
    id: "schoolyard-beer-garden-web",
    enabled: true,
    connector: "tribeEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.schoolyardbeergarden.com/events/",
    maxItems: 30,
    defaultVenueSlug: "schoolyard-beer-garden-and-cafe",
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
  {
    // Denver Comedy Underground (Five Points) runs on SeatEngine, which
    // server-renders each show as a `.event-list-item` card. `.event-times-group`
    // conveniently holds the date AND time together ("Wed, Jun 10, 2026 7:30 PM"),
    // so in-process cheerio (free) parses it — one listing per show at its soonest
    // date (recurring shows list multiple). Single venue, pinned; all Comedy.
    id: "denver-comedy-underground-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.denvercomedyunderground.com/events",
    selectors: {
      item: ".event-list-item",
      title: ".el-header",
      date: ".event-times-group",
      link: "a[href^='/events/']",
      image: ".el-image img",
    },
    maxItems: 40,
    defaultVenueSlug: "denver-comedy-underground",
    defaultCategory: "Comedy",
  },
  {
    // Elitch Gardens' Tribe Events calendar (/events/) is empty; its marquee
    // seasonal events live on the Divi-built /special-events/ page as
    // `.dsm_card_wrapper` cards (title + date range + a link to the event's own
    // page). In-process cheerio (free) parses them; the image pipeline pulls each
    // event's og:image from its detail page (the cards carry no inline image).
    // Single venue, pinned; category left per-event (Fiesta, Glowtopia, Fright
    // Fest, Blippi span festival/nightlife/seasonal/family).
    id: "elitch-gardens-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://elitchgardens.com/special-events/",
    selectors: {
      item: ".dsm_card_wrapper",
      title: ".dsm_card_title",
      date: ".dsm_card_subtitle",
      link: "a",
    },
    maxItems: 20,
    defaultVenueSlug: "elitch-gardens",
  },

  // Sports teams — pin to their home venue. Team sites (mlb/nba/nhl/nfl) are
  // JS-heavy SPAs, so each "web" source pulls from its league schedule API
  // (mlb/nba/nhl/nfl) instead; the Instagram companion adds promo/theme nights.
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
    // net-new events. Theme nights still arrive via ball-arena-web.
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
    // Denver's Art District on Santa Fe runs a Squarespace events collection
    // covering its member galleries — exhibitions, openings, First Friday art
    // walks, classes. Each event carries its gallery's name + address, so the
    // squarespaceEvents connector resolves a venue per gallery (CHAC, Rolo, Sync,
    // D'art, Museo…) — no defaultVenueSlug. All Arts & Culture.
    id: "denver-art-district-web",
    enabled: true,
    connector: "squarespaceEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://denversartdistrict.org/events",
    maxItems: 40,
    defaultCategory: "Arts & Culture",
  },
  {
    // The Empourium Brewing (Berkeley) runs on the SpotApps platform, which
    // server-renders each event as a `.event-calendar-card` (title h2, day, time,
    // description, image) — but the date + time live in separate elements, so
    // apifyWeb grabs the whole card's text for the normalizer (plus the real
    // SpotApps image). Static, so the cheap cheerio-scraper actor (no renderJs).
    // All at the one taproom — pin via defaultVenueSlug. Live music, comedy, drag
    // bingo, trivia + food trucks; category left per-event.
    id: "empourium-brewing-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://theempourium.com/denver-berkeley-the-empourium-brewing-company-events",
    selectors: {
      item: ".event-calendar-card",
    },
    maxItems: 40,
    defaultVenueSlug: "the-empourium-brewing-company",
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
    // React-hydrated list — static fetch yields empty <h4> titles; render JS.
    renderJs: true,
    waitForSelector: "[role=listitem] h4",
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
    // Events render client-side — the static cheerio fetch returns 0; render JS
    // (browser) and wait for the cards. Each .block-featured holds category,
    // date, space, title, description.
    renderJs: true,
    waitForSelector: ".block-featured",
    selectors: {
      item: ".block-featured",
    },
    defaultVenueName: "Museum of Contemporary Art Denver",
    defaultCategory: "Arts & Culture",
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
    // denverfilm.org runs on Eventive (a client-rendered widget, no public
    // feed). The /upcoming API returns the Now Playing set — current films
    // with showtimes — which the eventive connector collapses to one listing
    // per film (not per showtime) and pins to Sie FilmCenter. bucket + api_key
    // are the public widget values from the denverfilm.eventive.org tenant bundle.
    enabled: true,
    connector: "eventive",
    cadence: "weekly",
    sourceLabel: "Website",
    eventiveBucket: "5ed7cb60eb909700905eb9e4",
    eventiveApiKey: "285f587b83e6ab326e737e00d62ca378",
    defaultVenueSlug: "sie-filmcenter",
    defaultCategory: "Arts & Culture",
    maxItems: 40,
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

  // ── Additional curated source-sheet venues (reconcile-sources-to-sheet).
  // Each maps to a row in the curated Data Source sheet. Sources whose sites
  // expose a real datable event feed are enabled below; the rest are kept
  // disabled with a one-line note (menu/hours only, season-off, bot-walled,
  // private-bookings, or image-only Instagram) so the sheet↔code mapping is
  // complete and nobody re-investigates them blindly.
  {
    // The Family Jones (LoHi distillery) publishes a "Colorado spirits events"
    // calendar (WordPress + The Events Calendar) — its own tastings plus a heavy
    // schedule of partnered/offsite stops (farmers markets, bazaars, pop-ups),
    // each carrying its own venue/address, so no defaultVenueSlug. Kept enabled
    // for the unique Denver pop-ups it surfaces (craft walks, bazaars) that no
    // other source has; note some market rows geocode imperfectly. The site sits
    // behind SiteGround sgcaptcha (a 202 JS challenge the in-process tribeEvents
    // connector can't pass), so apifyWeb+renderJs runs a real browser to scrape
    // the Tribe list view.
    id: "family-jones-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://thefamilyjones.co/events/list/",
    renderJs: true,
    waitForSelector: ".tribe-events-calendar-list__event",
    waitForTimeoutMs: 45000,
    selectors: {
      item: ".tribe-events-calendar-list__event",
      title: ".tribe-events-calendar-list__event-title",
    },
    // The list view renders ~10 events per page; click through "Next Events"
    // to pull the fuller upcoming window in one browser session.
    paginateNextSelector: ".tribe-events-c-nav__next",
    maxItems: 60,
  },
  {
    // Stem Ciders (RiNo taproom + The Outpost on Platte) runs WordPress + The
    // Events Calendar; tribeEvents reads its /wp-json/tribe REST (Sunset Sessions
    // live music, slush weeks, markets). Events span the taproom and the Outpost,
    // each carrying its own venue, so no defaultVenueSlug.
    id: "stem-ciders-web",
    enabled: true,
    connector: "tribeEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://stemciders.com/events/",
    maxItems: 40,
    defaultCategory: "Food & Drink",
  },
  {
    // Acreage (Stem Ciders' cidery + farm kitchen, Lafayette) runs WordPress +
    // The Events Calendar; tribeEvents reads its /wp-json/tribe REST (sunset
    // yoga, tasting events). The feed carries the venue, so resolveOrCreateVenue
    // pins them — no seed needed.
    id: "acreage-web",
    enabled: true,
    connector: "tribeEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://acreageco.com/events/",
    maxItems: 30,
    defaultCategory: "Food & Drink",
  },
  {
    // Wix site without the Events app — the event lives in static marketing
    // content (one annual Denver "grand tasting" wine walk), so wixEvents found
    // nothing. apifyWeb+renderJs renders the Wix page; whole-page LLM extraction
    // (no item selector) reads the single event.
    id: "colorado-wine-walk-web",
    enabled: true,
    connector: "apifyWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: "https://www.coloradowinewalk.com/events",
    renderJs: true,
    waitForSelector: "h1",
    waitForTimeoutMs: 15000,
    maxItems: 5,
    defaultCategory: "Food & Drink",
  },

  // Disabled — sheet venues whose sites currently expose no datable public event
  // feed. Notes record the inspection so they aren't re-investigated blindly.
  // Squarespace "schedule" collection holds only private-event bookings, no public events.
  { id: "outside-pizza-web", enabled: false, connector: "squarespaceEvents", cadence: "weekly", sourceLabel: "Website", url: "https://www.outsidepizza.com/events", maxItems: 40 },
  // /events-releases has no dated event feed (beer releases); only a recurring "Sunset Sessions".
  { id: "great-divide-web", enabled: false, connector: "apifyWeb", cadence: "weekly", sourceLabel: "Website", url: "https://greatdivide.com/events-releases/", maxItems: 40 },
  // Site blocks automated fetch (403/timeout) even with a browser UA; revisit via Apify renderJs.
  { id: "westbound-down-web", enabled: false, connector: "apifyWeb", cadence: "weekly", sourceLabel: "Website", url: "https://www.westboundanddown.com/", maxItems: 40 },
  // Events run through an Eventbrite/Wix widget with no fetchable feed (distillery tours, live music).
  { id: "spirit-hound-web", enabled: false, connector: "wixEvents", cadence: "weekly", sourceLabel: "Website", url: "https://www.spirithounds.com/", maxItems: 40 },
  // Squarespace events collection is empty (no upcoming events); cafe is menu/hours only.
  { id: "hello-darling-web", enabled: false, connector: "squarespaceEvents", cadence: "weekly", sourceLabel: "Website", url: "https://hellodarling.cafe/events", maxItems: 40 },
  // /taproom-events is an empty/embedded Squarespace block — no dated event data exposed.
  { id: "crooked-stave-web", enabled: false, connector: "squarespaceEvents", cadence: "weekly", sourceLabel: "Website", url: "https://www.crookedstave.com/taproom-events", maxItems: 40 },
  // Recurring Happy Hour deal per location (2-5PM & 10PM-12AM daily). Priced
  // items are image-locked (see connector); window scraped from each location
  // page. Deals stay visible via the perpetual-deal window in persist.ts.
  { id: "cherry-cricket-deals", enabled: true, connector: "cherryCricketDeals", cadence: "weekly", sourceLabel: "Website", url: "https://cherrycricket.com/", defaultCategory: "Food & Drink" },
  // Sandwich-shop chain site, no events.
  { id: "snarfs-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://www.eatsnarfs.com/", maxItems: 40 },
  // Pizza-restaurant site (menus/locations), no events calendar.
  { id: "blue-pan-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://bluepandenver.com/", maxItems: 40 },
  // Weekly food-truck location schedule, not discrete datable events.
  { id: "blue-pan-food-truck-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://bluepandenver.com/food-truck/", maxItems: 40 },
  // Disabled: food-truck schedule IG. multiEvent fans the weekly post + the daily
  // "we're here today" posts into ~33 rows for ~10 real stops — heavy dups (same
  // stop, 2-3 title variants), wildly inconsistent geocoding (Cohesion -> 3
  // different neighborhoods), date-flooding (17 stops on one day), and half the
  // stops are private apartment complexes. Net feed noise.
  { id: "blue-pan-food-truck-ig", enabled: false, connector: "instagram", cadence: "weekly", sourceLabel: "Instagram", handle: "bluepanfoodtruck", defaultCategory: "Food & Drink", multiEvent: true },
  // Shopify coffee-retail site, no events.
  { id: "queen-city-coffee-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://queencitycollectivecoffee.com/", maxItems: 40 },
  // Square/Shopify coffee-retail site, no events.
  { id: "huckleberry-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://www.huckleberryroasters.com/", maxItems: 40 },
  // Food-hall site, no events page/feed (Wix marketing site).
  { id: "denver-central-market-web", enabled: false, connector: "wixEvents", cadence: "weekly", sourceLabel: "Website", url: "https://www.denvercentralmarket.com/", maxItems: 40 },
  // Square.site brewery page, no visible events listing.
  { id: "cellar-west-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://cellarwest.square.site/", maxItems: 40 },
  // Squarespace tattoo-shop site, no events page (flash drops only on Instagram).
  { id: "love-you-tattoo-web", enabled: false, connector: "squarespaceEvents", cadence: "weekly", sourceLabel: "Website", url: "https://www.loveyoutattooboulder.com/", maxItems: 40 },
  // City of Boulder events (Drupal). The full calendar is dominated by civic
  // meetings (City Council, Advisory Boards); filter to the public categories —
  // Recreation (event_category=4) + Community (5) — for Pops in the Parks, Walk/Bike,
  // cultural events and community programs, skipping the meetings. Server-rendered,
  // so static cheerioWeb. Boulder is in the metro taxonomy.
  {
    id: "boulder-events-web",
    enabled: true,
    connector: "cheerioWeb",
    cadence: "weekly",
    sourceLabel: "Website",
    url: [
      "https://bouldercolorado.gov/events?event_category=4",
      "https://bouldercolorado.gov/events?event_category=5",
      "https://bouldercolorado.gov/events?event_category=5&page=1",
    ],
    selectors: {
      item: ".event-card",
      title: ".event-card__title",
      // Without these the scraped text is title-only, so the normalizer can't
      // date the event (it never fetches the detail page) and every recurring
      // occurrence scrapes as identical text. The card carries a visible date
      // (.event-card__date, e.g. "Wed Jun 24 2026") and a venue subtitle.
      date: ".event-card__date",
      description: ".event-card__subtitle",
    },
    cityHint: "Boulder, CO",
    maxItems: 40,
  },
  // denvergov agency page has no events feed; shelter events are sporadic gov postings.
  { id: "denver-animal-shelter-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://www.denvergov.org/", maxItems: 40 },
  // Shopify lifestyle brand/blog + merch, not an event source.
  { id: "yocolorado-web", enabled: false, connector: "cheerioWeb", cadence: "weekly", sourceLabel: "Website", url: "https://www.yocolorado.com/", maxItems: 40 },

  // Disabled Instagram-only sheet rows — brand/image accounts (event details, if
  // any, are in flyer images, not captions; OCR is intentionally out of scope),
  // or redundant with a web source above.
  // Redundant with mcgregor-square-web (same plaza); F+D account posts menus/specials.
  { id: "mcgregor-square-foodanddrink-ig", enabled: false, connector: "instagram", cadence: "weekly", sourceLabel: "Instagram", handle: "mcgregorsquare_foodanddrink" },
  // Brewery-location brand account; any events covered by westbound-down-web. Image-heavy.
  { id: "westbound-denver-ig", enabled: false, connector: "instagram", cadence: "weekly", sourceLabel: "Instagram", handle: "westbound_denver" },
  // Covered by stem-ciders-web; account posts brand/image content, not caption events.
  { id: "stem-ciders-rino-ig", enabled: false, connector: "instagram", cadence: "weekly", sourceLabel: "Instagram", handle: "stemcidersrino" },
  // Brand/image account, no caption-level event data (OCR out of scope).
  // The Courtyard (by The Jasmine Bar, Louisville CO) posts its live-music
  // schedule as flyer images — notably a "Summer Concert Series" graphic listing
  // ~28 dated shows. Disabled: jasmine-bar-web already ingests this exact series
  // from the venue's Squarespace feed (a cleaner Website source that wins dedup),
  // so vision-OCR'ing the IG here is redundant — it only adds the occasional
  // one-off flyer (Derby/Easter) at the cost of ~30 vision calls/run plus
  // near-dup and year-old-post noise. The instagramVision connector it would use
  // (vision-OCR per post) stays available for flyer-only IG venues with NO feed.
  { id: "courtyard-303-ig", enabled: false, connector: "instagramVision", cadence: "weekly", sourceLabel: "Instagram", handle: "thecourtyard303", defaultVenueName: "The Courtyard", defaultCategory: "Music", cityHint: "Louisville, CO", maxItems: 60 },
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
