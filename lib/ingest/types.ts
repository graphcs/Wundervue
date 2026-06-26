import type { ListingType, LifestyleTag, ListingSource } from "@/lib/types";

export type Cadence = "hourly" | "daily" | "weekly";

export type ConnectorKind =
  | "instagram"
  | "instagramVision"
  | "serpEvents"
  | "apifyWeb"
  | "cheerioWeb"
  | "venuePilot"
  | "wixEvents"
  | "fullCalendarFeed"
  | "mlbSchedule"
  | "nbaSchedule"
  | "nhlSchedule"
  | "nflSchedule"
  | "aquariumCalendar"
  | "wpRestEvents"
  | "comedyWorksCalendar"
  | "denverUnionStation"
  | "squarespaceEvents"
  | "tribeEvents"
  | "botanicGardensCalendar"
  | "eventRssFeed"
  | "denverSummitFcSchedule"
  | "ticketmasterVenue"
  | "jsonLdEvents"
  | "icsCalendar"
  | "libcalEvents"
  | "potteryWithPurpose"
  | "averyTaproomEvents"
  | "eventive"
  | "dmnsEvents"
  | "aegEvents"
  | "cherryCricketDeals"
  | "popmenuEvents"
  | "squarespaceProducts"
  | "elfsightCalendar"
  | "localistEvents"
  | "cityLightEvents"
  | "flyerImage"
  | "screenshotVision";

export interface SourceConfig {
  id: string;
  enabled: boolean;
  connector: ConnectorKind;
  cadence: Cadence;
  sourceLabel: ListingSource;

  // connector-specific
  // Instagram handles to scrape. Pass a single account ("missionballroom")
  // or an array for fanning out across multiple organizers. Apify charges
  // per URL, so prefer hashtags for broad community coverage and handles
  // for known event-posting accounts.
  handle?: string | string[];
  // Instagram hashtags (no leading #). Single string or array for
  // multi-tag coverage, e.g. ["denverdogs", "yappyhourdenver"].
  hashtag?: string | string[];
  // venuePilot — VenuePilot account id(s) from the venue's embed config.
  venuePilotAccountIds?: number[];
  // mlbSchedule — MLB StatsAPI team id (Colorado Rockies = 115).
  mlbTeamId?: number;
  // nbaSchedule — NBA franchise id for the home-game filter (Denver Nuggets =
  // 1610612743) plus the team slug used in the data.nba.com feed path and the
  // public schedule URL (nba.com/<slug>/schedule, e.g. "nuggets").
  nbaTeamId?: number;
  nbaTeamSlug?: string;
  // nhlSchedule — NHL team abbreviation for the home-game filter (Colorado
  // Avalanche = "COL") plus the team slug used in the public schedule URL
  // (nhl.com/<slug>/schedule, e.g. "avalanche"). The season is resolved
  // automatically via the API's /now endpoint, so no year is configured.
  nhlTeamAbbrev?: string;
  nhlTeamSlug?: string;
  // nflSchedule — ESPN team abbreviation for the schedule feed + home-game
  // filter (Denver Broncos = "DEN"). The human-facing schedule link comes from
  // `url` (e.g. denverbroncos.com/schedule). The season is resolved by ESPN's
  // default team-schedule endpoint, so no year is configured.
  nflTeamAbbrev?: string;
  query?: string;              // serpEvents — Google Events search query
  serpHtichips?: string;       // serpEvents — optional Google date/type filter (e.g. "date:week")
  // apifyWeb / cheerioWeb. A single page URL, or an array to scrape several
  // pages in one source (e.g. a site whose /events calendar is JS-rendered but
  // whose individual event subpages are static). Each URL is fetched and its
  // content handed to the normalizer independently.
  url?: string | string[];
  selectors?: {
    item: string;
    title?: string;
    description?: string;
    date?: string;
    image?: string;
    link?: string;
  };
  // cheerioWeb — opt-in detail-page enrichment. Some sites show the date on the
  // list card but the TIME only on the event's own page (e.g. Boulder's Drupal
  // events: list cards have no time, the detail page has a "Time" field). When
  // set, the connector fetches each item's link and appends this selector's text
  // so normalize() can read the time. Use only for sources with cheap (static,
  // non-Cloudflare) detail pages — each kept item costs one extra fetch.
  detailSelector?: string;
  // comedyWorksCalendar — how many months past the current one to crawl (the
  // calendar pages one month per URL). Default 3 (current + next 3 = 4 months).
  monthsAhead?: number;
  // comedyWorksCalendar — which physical club this source covers. The calendar
  // interleaves both Comedy Works clubs (and external "concerts"); the connector
  // keeps only events tagged for this club so each source can pin authoritatively
  // via defaultVenueSlug. Omit to collect every club (untagged concerts excluded).
  comedyWorksClub?: "downtown" | "south";
  // apifyWeb — render JavaScript with a real browser (apify/web-scraper) instead
  // of the default static cheerio-scraper. Needed for client-rendered widgets
  // (e.g. Wix Events). Pair with `selectors` + `waitForSelector`.
  renderJs?: boolean;
  // apifyWeb (renderJs) — CSS selector to wait for before extracting, so the
  // dynamically-loaded content has rendered.
  waitForSelector?: string;
  // apifyWeb (renderJs) — how long to wait for waitForSelector (ms, default
  // 20000). Bump it for slow widgets (e.g. the AEG/AXS calendar takes ~30-50s).
  waitForTimeoutMs?: number;
  // apifyWeb (renderJs) — CSS selector for a "next page" control on an
  // AJAX-paginated list (e.g. The Events Calendar list nav,
  // `.tribe-events-c-nav__next`). When set, the browser pageFunction clicks it
  // and accumulates items across pages until it reaches `maxItems` or the
  // control is gone/disabled — list views that render only a small window per
  // page would otherwise yield just the soonest handful.
  paginateNextSelector?: string;
  // apifyWeb / cheerioWeb — cap on how many extracted items to keep. Pages with
  // long, chronologically-ordered event grids (e.g. a venue calendar with 150+
  // shows) would otherwise push every future event through LLM normalization
  // and image resolution. Items are kept in document order, so this yields the
  // soonest N; weekly re-runs pull the window forward.
  maxItems?: number;
  // cityLightEvents — base URL to resolve the widget's relative event links
  // (e.g. "/do/<slug>") into absolute source_urls, since the data API lives on a
  // different host than the display site.
  linkBase?: string;

  // eventive — Eventive event-bucket id + publishable widget api_key (both
  // public, from the <org>.eventive.org tenant bundle). See connectors/eventive.ts.
  eventiveBucket?: string;
  eventiveApiKey?: string;

  // flyerImage — max content images from the page to send to the vision model.
  maxImages?: number;

  // icsCalendar — include ACTIVE recurring (RRULE) entries instead of skipping
  // all of them. Opt-in for calendars whose recurring entries are real events/
  // deals worth keeping (a weekly happy hour, trivia night); expired series
  // (UNTIL in the past) are still dropped.
  icsIncludeRecurring?: boolean;

  // metadata hints for the LLM and venue resolution
  defaultVenueSlug?: string;
  // squarespaceEvents — venue name to label each event with (the Squarespace
  // feed's per-item location is often the platform's empty default). Used as the
  // venueName hint in the blob; the normalizer can still refine from the title.
  defaultVenueName?: string;
  // Street address for a single-venue source whose entries omit it (e.g. an
  // icsCalendar feed where each event only implies the venue). Injected so the
  // venue geocodes — and reverse-geocodes to the right metro city — instead of
  // failing a name-only lookup and defaulting to a wrong neighborhood. Pair with
  // defaultVenueName.
  defaultVenueAddress?: string;
  // Neighborhood label for a single-venue source, used when the reverse-geocode
  // of the pin resolves only to a broad region (e.g. a S. Broadway bar that
  // reverse-geocodes to "Central Denver" instead of "Baker"). Mapped to the full
  // city/neighborhood slug chain. Only honored for single-venue sources (those
  // with defaultVenueAddress).
  defaultNeighborhood?: string;
  defaultCategory?: string;
  // Fixed operating hours for a single-venue source whose events don't state a
  // time (e.g. a zoo "9:00 AM – 4:00 PM"). Used as the time_display fallback in
  // buildListingInsert. Only set for venues with genuinely consistent hours —
  // event venues with varying showtimes should leave it unset.
  defaultTime?: string;
  // Single-city sources whose page text gives bare venue names with no city —
  // appended as the geocode hint ("<venue>, <cityHint>") and venue-slug suffix
  // so e.g. a Boulder park doesn't resolve to a same-named Denver-area place.
  // Defaults to "Denver, CO" in resolveOrCreateVenue when unset.
  cityHint?: string;

  // Opt-in: when true, a single caption that lists several events is split into
  // one listing per event via normalizeMulti() (vs normalize()'s one-per-caption
  // default). Reusable on any source whose posts are monthly/weekly roundups;
  // leave unset for the vast majority. See lib/ingest/normalize.ts.
  multiEvent?: boolean;
}

export interface RawItem {
  sourceId: string;
  sourceUrl?: string;
  text: string;
  imageUrl?: string;
  fetchedAt: string;
  // Connector-supplied venue/address hints. Populated when the upstream
  // (e.g. SerpAPI) returns these as structured fields. Used as a fallback in
  // normalize.ts when the LLM fails to extract them from the prose blob.
  venueName?: string;
  address?: string;
  // Connector-asserted recurrence (e.g. an icsCalendar RRULE master). When true,
  // mapRawEvent forces the normalized listing recurring regardless of the LLM —
  // the connector parsed the recurrence rule, so it's authoritative.
  recurring?: boolean;
}

export interface NormalizedListing {
  isEventOrDeal: boolean;
  type: ListingType;
  title: string;
  canonicalTitle: string;
  description: string;
  category: string;
  neighborhood: string;
  dateStart: string | null;
  dateEnd: string | null;
  dateDisplay: string;
  timeDisplay: string;
  isFree: boolean;
  dealValue: string | null;
  // True for an ongoing/recurring offering with no fixed end — a daily happy
  // hour, "now available", a weekly special. Deals flagged recurring get a
  // rolling visibility window in buildListingInsert so they don't vanish from
  // the date-based feed (see persist.ts).
  recurring?: boolean;
  // The connector's explicit recurrence assertion (RawItem.recurring), kept apart
  // from `recurring` so occurrence-splitting can distinguish a connector that
  // emitted pre-expanded, specific-day instances (false → never re-split, even if
  // a description says "every Thursday") from the LLM merely defaulting to false
  // (undefined → the weekly-text heuristic may still split).
  connectorRecurring?: boolean;
  tags: LifestyleTag[];
  // Free-text venue / address extracted from the source. Used to look up an
  // existing venue row or create a new one (with geocoded lat/lng) so the map
  // can pin the listing.
  venueName: string | null;
  address: string | null;
}

export interface DbListing {
  id: string;
  slug: string;
  type: ListingType;
  title: string;
  description: string;
  venue_id: string | null;
  address: string | null;
  neighborhood: string | null;
  // Resolved taxonomy slugs (lib/data/locations.ts). Denormalized from
  // neighborhood; nullable when the place can't be resolved.
  region_slug: string | null;
  city_slug: string | null;
  neighborhood_slug: string | null;
  category: string | null;
  date_start: string | null;
  date_end: string | null;
  date_display: string | null;
  time_display: string | null;
  is_free: boolean;
  deal_value: string | null;
  image_url: string | null;
  image_source: "existing" | "scraped" | "og-image" | "generated" | "placeholder" | null;
  source: string;
  source_url: string | null;
  source_id: string;
  event_key: string;
  dedup_of: string | null;
  tags: string[];
  lat: number | null;
  lng: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DedupAction =
  | { kind: "insert"; row: ListingInsert }
  | { kind: "update"; row: ListingInsert; existingId: string }
  // Same source produced a new source_id for an event that already exists
  // under an old source_id (e.g. a connector's keying algorithm changed).
  // Update the canonical row in place by id — this also overwrites its
  // source_id with the new format so the next run matches via the cheap
  // same-source lookup instead of re-doing the event_key crossMatch.
  | { kind: "merge"; row: ListingInsert; existingId: string }
  | { kind: "skip-duplicate"; row: ListingInsert; canonicalId: string };

export type ListingInsert = Omit<DbListing, "id" | "created_at" | "updated_at">;

export interface IngestResult {
  sourceId: string;
  status: "ok" | "failed" | "skipped";
  itemsSeen: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsDuplicate: number;
  error?: string;
}
