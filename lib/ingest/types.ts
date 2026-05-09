import type { ListingType, LifestyleTag, ListingSource } from "@/lib/types";

export type Cadence = "hourly" | "daily" | "weekly";

export type ConnectorKind = "instagram" | "serpEvents" | "apifyWeb" | "cheerioWeb";

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
  url?: string;                // apifyWeb / cheerioWeb
  selectors?: {
    item: string;
    title?: string;
    description?: string;
    date?: string;
    image?: string;
    link?: string;
  };

  // metadata hints for the LLM and venue resolution
  defaultVenueSlug?: string;
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
