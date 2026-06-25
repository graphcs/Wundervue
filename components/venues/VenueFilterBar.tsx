"use client";

import { useRouter } from "next/navigation";
import { VENUE_CATEGORY_FILTER_OPTIONS } from "@/lib/data/categories";
import type { DynamicCity } from "@/lib/data/locations";
import { toggleInArray } from "@/lib/array";
import type { DatePreset } from "@/lib/types";
import { buildVenuesHref, type VenueFilters, type VenueSort } from "@/lib/venues/browseParams";
import { Pill } from "@/components/ui/Pill";
import { SearchIcon } from "@/components/detail/icons";
import { DateDropdown } from "@/components/explore/DateDropdown";
import { DropdownPill } from "@/components/explore/DropdownPill";
import { LifestyleFilterPills } from "@/components/explore/LifestyleFilterPills";
import { MultiDropdownPill } from "@/components/explore/MultiDropdownPill";
import { LocationFilterDropdown } from "@/components/explore/LocationFilterDropdown";

interface Props {
  filters: VenueFilters;
  showMineToggle: boolean;
  basePath: string;
  sticky: Record<string, string>;
  dynamicCities: readonly DynamicCity[];
}

const SORT_OPTIONS: { id: VenueSort; label: string }[] = [
  { id: "upcoming", label: "Most upcoming" },
  { id: "saved", label: "Most saved" },
  { id: "followed", label: "Most followed" },
];

export function VenueFilterBar({ filters, showMineToggle, basePath, sticky, dynamicCities }: Props) {
  const { mine, q, cats, locs, sort, hasUpcoming, date, from, to, lifestyle } = filters;
  const router = useRouter();

  const go = (overrides: Partial<VenueFilters>) =>
    router.push(buildVenuesHref({ basePath, sticky, filters: { ...filters, ...overrides }, showMineToggle }));

  return (
    <div className="mb-5 flex flex-col gap-3">
      {showMineToggle && (
        <div className="flex gap-1.5">
          <Pill active={!mine} onClick={() => go({ mine: false })}>All venues</Pill>
          <Pill active={mine} onClick={() => go({ mine: true })}>My Venues</Pill>
        </div>
      )}

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = ((new FormData(e.currentTarget).get("vq") as string) ?? "").trim();
          go({ q: value });
        }}
        className="flex gap-2.5"
      >
        <div className="relative flex-1">
          <span className="text-chrome pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
            <SearchIcon size={15} />
          </span>
          <input
            key={q}
            type="search"
            name="vq"
            defaultValue={q}
            placeholder="Search venues by name or neighborhood…"
            className="border-border text-dark placeholder:text-chrome rounded-pill w-full border bg-white py-2.5 pl-11 pr-4 text-sm focus:border-dark focus:outline-none"
          />
        </div>
        <button type="submit" className="bg-dark rounded-pill px-6 text-xs font-medium uppercase tracking-wider text-white hover:opacity-90">
          Search
        </button>
      </form>

      {/* Date · Category · Location · Sort · Lifestyle · Has-upcoming */}
      <div className="flex flex-wrap items-center gap-2">
        <DateDropdown
          value={date}
          from={from}
          to={to}
          onChange={(next: { date: DatePreset; from?: string; to?: string }) =>
            go({ date: next.date, from: next.from, to: next.to })
          }
        />
        <MultiDropdownPill
          label="Category"
          options={VENUE_CATEGORY_FILTER_OPTIONS}
          selected={cats}
          onToggle={(slug) => go({ cats: toggleInArray(cats, slug) })}
        />
        <LocationFilterDropdown
          label="Location"
          selected={locs}
          onToggle={(slug) => go({ locs: toggleInArray(locs, slug) })}
          onClear={() => go({ locs: [] })}
          dynamicCities={dynamicCities}
        />
        <DropdownPill
          label="Sort"
          options={SORT_OPTIONS}
          value={sort}
          onChange={(id) => go({ sort: id })}
        />
        <Pill active={hasUpcoming} onClick={() => go({ hasUpcoming: !hasUpcoming })}>
          Has upcoming events
        </Pill>
        <div className="mx-0.5 hidden h-[18px] w-px bg-[#d5d5d5] sm:block" />
        <LifestyleFilterPills
          selected={lifestyle}
          onToggle={(tag) => go({ lifestyle: toggleInArray(lifestyle, tag) })}
        />
      </div>
    </div>
  );
}
