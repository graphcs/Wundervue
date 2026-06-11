import type { ListingType, LifestyleTag, ListingSource } from "@/lib/types";

export type Cadence = "hourly" | "daily" | "weekly";

export type ConnectorKind =
  | "instagram"
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
  | "averyTaproomEvents";

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
  // apifyWeb / cheerioWeb — cap on how many extracted items to keep. Pages with
  // long, chronologically-ordered event grids (e.g. a venue calendar with 150+
  // shows) would otherwise push every future event through LLM normalization
  // and image resolution. Items are kept in document order, so this yields the
  // soonest N; weekly re-runs pull the window forward.
  maxItems?: number;

  // metadata hints for the LLM and venue resolution
  defaultVenueSlug?: string;
  // squarespaceEvents — venue name to label each event with (the Squarespace
  // feed's per-item location is often the platform's empty default). Used as the
  // venueName hint in the blob; the normalizer can still refine from the title.
  defaultVenueName?: string;
  defaultCategory?: string;
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
