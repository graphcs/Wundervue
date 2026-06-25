"use client";

import { CATEGORY_FILTER_OPTIONS } from "@/lib/data/categories";
import { LIFESTYLE_TAGS } from "@/lib/filters/types";
import type { DatePreset, LifestyleTag, SortOption } from "@/lib/types";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Pill } from "@/components/ui/Pill";
import { DateDropdown } from "./DateDropdown";
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
  // Same gating as the explore feed: lifestyle filtering is Insider-only.
  const { profile, isLoggedIn, openUpgrade } = useAuthContext();
  const lifestyleGated = !isLoggedIn || profile?.plan !== "insider";

  const set = (patch: Partial<VenueListingFilterState>) =>
    onChange({ ...value, ...patch });
  const toggleCat = (slug: string) =>
    set({
      categories: value.categories.includes(slug)
        ? value.categories.filter((c) => c !== slug)
        : [...value.categories, slug],
    });
  const toggleTag = (tag: LifestyleTag) =>
    set({
      lifestyle: value.lifestyle.includes(tag)
        ? value.lifestyle.filter((t) => t !== tag)
        : [...value.lifestyle, tag],
    });

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
        onToggle={toggleCat}
      />
      <SortDropdown value={value.sort} onChange={(sort) => set({ sort })} />
      <Pill active={value.freeOnly} onClick={() => set({ freeOnly: !value.freeOnly })}>
        Free Only
      </Pill>
      <div className="mx-0.5 hidden h-[18px] w-px bg-[#d5d5d5] sm:block" />
      {LIFESTYLE_TAGS.map((tag) => (
        <Pill
          key={tag.id}
          active={value.lifestyle.includes(tag.id)}
          onClick={() => {
            if (lifestyleGated) {
              openUpgrade();
              return;
            }
            toggleTag(tag.id as LifestyleTag);
          }}
          title={lifestyleGated ? "Lifestyle filters — Insider only" : undefined}
        >
          <span className="text-[13px] leading-none">{tag.emoji}</span>
          {tag.label}
        </Pill>
      ))}
    </div>
  );
}
