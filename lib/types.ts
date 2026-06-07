export type ListingType = "event" | "deal" | "both";

export type LifestyleTag =
  | "date-night"
  | "dog-friendly"
  | "family"
  | "outdoor";

export type ListingSource = "Instagram" | "Website" | "Meetup";

export interface Listing {
  id: string;
  slug: string;
  type: ListingType;
  title: string;
  description: string;
  venueId: string;
  venueName: string;
  address: string;
  neighborhood: string;
  category: string;
  startAt: string;
  endAt: string | null;
  dateDisplay: string;
  timeDisplay: string;
  isFree: boolean;
  dealValue?: string;
  imageUrl: string;
  source: ListingSource;
  sourceUrl?: string;
  tags: LifestyleTag[];
  // How many users have saved this listing (social proof). Optional: only the
  // DB-backed reads populate it; fixtures and other mappers omit it (treated 0).
  saveCount?: number;
  // null when the venue hasn't been geocoded yet. Map renderers must filter
  // before reading; (0,0) is a real point on the globe and not a sentinel.
  lat: number | null;
  lng: number | null;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  description: string;
  address: string;
  neighborhood: string;
  imageUrl?: string;
  lat: number;
  lng: number;
  // Category slugs the venue is tagged with (derived from its listings).
  categories?: string[];
}

export interface NeighborhoodOption {
  slug: string;
  label: string;
}

export interface CategoryOption {
  slug: string;
  label: string;
}

export type DatePreset =
  | "any"
  | "today"
  | "this-weekend"
  | "this-week"
  | "this-month"
  | "next-month"
  | "custom";

export type TypeFilter = "all" | "events" | "deals" | "both";

export type PageSize = 9 | 12 | 15 | 18;

// Listing ordering. "soonest" is the default (events happening first). Price-
// and popularity-based sorts are planned but need a numeric price column /
// save-count aggregation before they can be offered.
export type SortOption = "soonest" | "latest";

export type ViewMode = "grid" | "map" | "calendar" | "for-you";

export interface Filters {
  type: TypeFilter;
  neighborhoods: string[];
  categories: string[];
  date: DatePreset;
  from?: string;
  to?: string;
  lifestyle: LifestyleTag[];
  freeOnly: boolean;
  q?: string;
  sort: SortOption;
  view: ViewMode;
  pageSize: PageSize;
  venue?: string;
}
