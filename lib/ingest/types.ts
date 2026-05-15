import type { ListingType, LifestyleTag, ListingSource } from "@/lib/types";

export type Cadence = "hourly" | "daily" | "weekly";

export type ConnectorKind =
  | "instagram"
  | "serpEvents"
  | "apifyWeb"
  | "cheerioWeb"
  | "jsonLdEvents"
  | "venuePilot"
  | "eventive"
  | "wixEvents"
  | "nbaSchedule"
  | "nhlSchedule"
  | "kseTicketmaster";

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
  query?: string;              // serpEvents — Google Events search query
  serpHtichips?: string;       // serpEvents — optional Google date/type filter (e.g. "date:week")
  url?: string;                // apifyWeb / cheerioWeb / jsonLdEvents
  // cheerioWeb only: fetch each URL with the same selectors and concat
  // results. Used for sites where each "event" is its own page (e.g.
  // an "Events" dropdown menu where each item links to a dedicated page).
  urls?: string[];
  selectors?: {
    item: string;
    title?: string;
    description?: string;
    date?: string;
    image?: string;
    link?: string;
  };

  // eventive: tenant slug + tenant API key + event_bucket ID for
  // Eventive-backed cinema sites (Denver Film, many indie festivals).
  // The api_key is a public anon key embedded in each tenant's JS
  // bundle — not secret, but customer-specific, so it lives per-source.
  // The tenant slug ("denverfilm") seeds the public schedule URL
  // ({tenant}.eventive.org/schedule/{eventId}).
  eventiveTenant?: string;
  eventiveApiKey?: string;
  eventiveEventBucketId?: string;

  // nbaSchedule: NBA team tricode (e.g. "DEN" for Denver Nuggets) to
  // filter the team-schedule page down to home games only — away games
  // happen in other cities and shouldn't surface on Denver's /explore.
  nbaHomeTeamTricode?: string;

  // nhlSchedule: NHL team tricode (e.g. "COL" for Colorado Avalanche)
  // used both in the API URL and to filter for home games.
  nhlTeamTricode?: string;

  // kseTicketmaster: Ticketmaster venue ID for the KSE alttix proxy
  // (e.g. "KovZpZAFa1nA" for Paramount Theatre Denver). Endpoint is
  // alttix.ksehq.com/api/tm/venue/{id} which returns the standard
  // Ticketmaster Discovery API event array.
  kseTmVenueId?: string;

  // venuePilot: account IDs to query. Most VenuePilot-backed venues
  // (Levitt Denver, etc.) expose their event list via VenuePilot's public
  // GraphQL `publicEvents` query keyed by accountIds.
  venuePilotAccountIds?: number[];

  // metadata hints for the LLM and venue resolution
  defaultVenueSlug?: string;
  defaultCategory?: string;

  // Hard cap on raw items returned by the connector. Necessary for sources
  // that can over-deliver and push the downstream LLM + image pipeline
  // past Vercel's 5min function ceiling.
  //   - cheerioWeb: capped in DOM order (most events pages list
  //     date-ascending; far-future tail gets picked up by later runs).
  //   - instagram: capped after Apify returns (Apify's resultsLimit isn't
  //     always respected — observed 539 results back from a 180 cap).
  maxItems?: number;
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
  category: string | null;
  date_start: string | null;
  date_end: string | null;
  date_display: string | null;
  time_display: string | null;
  is_free: boolean;
  deal_value: string | null;
  image_url: string | null;
  image_source: "existing" | "scraped" | "og-image" | "generated" | null;
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
