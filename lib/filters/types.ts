export type {
  Filters,
  DatePreset,
  TypeFilter,
  LifestyleTag,
  PageSize,
  SortOption,
  ViewMode,
} from "@/lib/types";

export const SORT_OPTIONS = [
  { id: "soonest", label: "Soonest" },
  { id: "latest", label: "Latest" },
  { id: "free-first", label: "Free first" },
  { id: "deals-first", label: "Deals first" },
  { id: "most-saved", label: "Most saved" },
] as const;

// Default is 18 (densest grid). Other options step down to 9.
export const PAGE_SIZE_OPTIONS = [
  { id: "9", label: "9" },
  { id: "12", label: "12" },
  { id: "15", label: "15" },
  { id: "18", label: "18" },
] as const;

export const PAGE_SIZES = [9, 12, 15, 18] as const;

// Default listings per page (densest grid). Single source — parseSearchParams,
// buildHref, and paginate all reference it.
export const DEFAULT_PAGE_SIZE = 18;

export const LIFESTYLE_TAGS = [
  { id: "dog-friendly", label: "Dog-Friendly", emoji: "🐕" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "date-night", label: "Date Night", emoji: "🌙" },
  { id: "outdoor", label: "Outdoor", emoji: "⛰️" },
] as const;

// Lookup by tag id for rendering a listing's lifestyle tags as labeled chips
// (used by both the card and the detail view). Single source of truth so the
// chips, filter pills, and URL parser never drift apart.
export const LIFESTYLE_TAG_BY_ID: Record<
  string,
  { id: string; label: string; emoji: string }
> = Object.fromEntries(LIFESTYLE_TAGS.map((t) => [t.id, t]));

export const DATE_PRESETS = [
  { id: "any", label: "Any Date" },
  { id: "today", label: "Today" },
  { id: "this-weekend", label: "This Weekend" },
  { id: "this-week", label: "This Week" },
  { id: "this-month", label: "This Month" },
  { id: "next-month", label: "Next Month" },
  { id: "custom", label: "Custom Range" },
] as const;

export const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "events", label: "Events" },
  { id: "deals", label: "Deals" },
  { id: "both", label: "Events + Deals" },
] as const;
