"use client";

import { CATEGORY_FILTER_OPTIONS } from "@/lib/data/categories";
import { toggleInArray } from "@/lib/array";
import type { DatePreset, LifestyleTag, SortOption } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";
import { DateDropdown } from "./DateDropdown";
import { LifestyleFilterPills } from "./LifestyleFilterPills";
import { MultiDropdownPill } from "./MultiDropdownPill";
import { SortDropdown } from "./SortDropdown";

// The subset of explore filters that make sense for a single venue's listings:
// the tabs already split type, and location is fixed to this one venue.
export interface VenueListingFilterState {
  date: DatePreset;
  from?: string;
  to?: string;
  categories: string[];
  lifestyle: LifestyleTag[];
  freeOnly: boolean;
  sort: SortOption;
}

export const VENUE_LISTING_FILTER_DEFAULTS: VenueListingFilterState = {
  date: "any",
  categories: [],
  lifestyle: [],
  freeOnly: false,
  sort: "soonest",
};

interface Props {
  value: VenueListingFilterState;
  onChange: (next: VenueListingFilterState) => void;
}

export function VenueListingFilterBar({ value, onChange }: Props) {
  const set = (patch: Partial<VenueListingFilterState>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <DateDropdown
        value={value.date}
        from={value.from}
        to={value.to}
        onChange={(next) => set({ date: next.date, from: next.from, to: next.to })}
      />
      <MultiDropdownPill
        label="Category"
        options={CATEGORY_FILTER_OPTIONS}
        selected={value.categories}
        onToggle={(slug) => set({ categories: toggleInArray(value.categories, slug) })}
      />
      <SortDropdown value={value.sort} onChange={(sort) => set({ sort })} />
      <Pill active={value.freeOnly} onClick={() => set({ freeOnly: !value.freeOnly })}>
        Free Only
      </Pill>
      <div className="mx-0.5 hidden h-[18px] w-px bg-[#d5d5d5] sm:block" />
      <LifestyleFilterPills
        selected={value.lifestyle}
        onToggle={(tag) => set({ lifestyle: toggleInArray(value.lifestyle, tag) })}
      />
    </div>
  );
}
