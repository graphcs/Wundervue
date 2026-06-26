// Single source of truth for the /venues + homepage "My Venues" filter params.
// Both the server pipeline (VenuesBrowse) and the client bar (VenueFilterBar)
// parse and build URLs through here so the param contract can't drift.

import { DATE_PRESETS, LIFESTYLE_TAGS } from "@/lib/filters/types";
import type { DatePreset, LifestyleTag } from "@/lib/types";

export type VenueSort = "upcoming" | "saved" | "followed";

const VALID_VENUE_SORTS: readonly VenueSort[] = ["upcoming", "saved", "followed"];

export function parseVenueSort(value: string | undefined): VenueSort {
  return (VALID_VENUE_SORTS as readonly string[]).includes(value ?? "")
    ? (value as VenueSort)
    : "upcoming";
}

const VALID_DATES: readonly string[] = DATE_PRESETS.map((d) => d.id);
const VALID_LIFESTYLE: readonly string[] = LIFESTYLE_TAGS.map((t) => t.id);

export function parseVenueDate(value: string | undefined): DatePreset {
  return VALID_DATES.includes(value ?? "") ? (value as DatePreset) : "any";
}

export function parseVenueLifestyle(values: string[]): LifestyleTag[] {
  return values.filter((v) => VALID_LIFESTYLE.includes(v)) as LifestyleTag[];
}

export interface VenueFilters {
  mine: boolean;
  q: string;
  cats: string[];
  locs: string[];
  sort: VenueSort;
  hasUpcoming: boolean;
  /** "Time" filter — keeps venues with an upcoming event in this window. */
  date: DatePreset;
  from?: string;
  to?: string;
  /** Lifestyle tags (outdoor, dog-friendly, …) an upcoming event must carry. */
  lifestyle: LifestyleTag[];
}

// Build a /venues (or "/") href from venue filters. Always preserves `sticky`
// (e.g. tab=my-venues) and resets pagination; omits defaults to keep URLs clean.
export function buildVenuesHref(opts: {
  basePath: string;
  sticky: Record<string, string>;
  filters: VenueFilters;
  showMineToggle: boolean;
}): string {
  const { basePath, sticky, filters: f, showMineToggle } = opts;
  const params = new URLSearchParams(sticky);
  if (f.mine && showMineToggle) params.set("mine", "1");
  if (f.q) params.set("vq", f.q);
  if (f.cats.length) params.set("vcat", f.cats.join(","));
  if (f.locs.length) params.set("vloc", f.locs.join(","));
  if (f.sort !== "upcoming") params.set("vsort", f.sort);
  if (!f.hasUpcoming) params.set("vupcoming", "0");
  if (f.date !== "any") params.set("vdate", f.date);
  if (f.from) params.set("vfrom", f.from);
  if (f.to) params.set("vto", f.to);
  if (f.lifestyle.length) params.set("vlife", f.lifestyle.join(","));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
