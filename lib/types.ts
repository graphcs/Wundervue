export type ListingType = "event" | "deal" | "both";

export type LifestyleTag =
  | "date-night"
  | "dog-friendly"
  | "family"
  | "outdoor";

export type ListingSource = "Instagram" | "Website" | "Meetup";

export interface Listing {
  id: number;
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
  lat: number;
  lng: number;
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
  view: "grid" | "map";
  venue?: string;
}
