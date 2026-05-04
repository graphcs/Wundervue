export type {
  Filters,
  DatePreset,
  TypeFilter,
  LifestyleTag,
  PageSize,
} from "@/lib/types";

// Default is 9 (matches the 3x3 grid). Increments of 3 from there.
export const PAGE_SIZE_OPTIONS = [
  { id: "9", label: "9" },
  { id: "12", label: "12" },
  { id: "15", label: "15" },
  { id: "18", label: "18" },
] as const;

export const PAGE_SIZES = [9, 12, 15, 18] as const;

export const LIFESTYLE_TAGS = [
  { id: "dog-friendly", label: "Dog-Friendly", emoji: "🐕" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "date-night", label: "Date Night", emoji: "🌙" },
  { id: "outdoor", label: "Outdoor", emoji: "⛰️" },
] as const;

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
