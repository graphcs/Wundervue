"use client";

import { useMemo, useState } from "react";
import type { Filters, Listing } from "@/lib/types";
import { applyFilters } from "@/lib/filters/applyFilters";
import { ListingGrid } from "./ListingGrid";
import {
  VenueListingFilterBar,
  VENUE_LISTING_FILTER_DEFAULTS,
  type VenueListingFilterState,
} from "./VenueListingFilterBar";

interface Props {
  upcoming: Listing[];
  deals: Listing[];
  past: Listing[];
}

const TABS = [
  { id: "upcoming", label: "Upcoming Events" },
  { id: "deals", label: "Active Deals" },
  { id: "past", label: "Past Events" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function VenueTabs({ upcoming, deals, past }: Props) {
  const counts: Record<TabId, number> = {
    upcoming: upcoming.length,
    deals: deals.length,
    past: past.length,
  };
  const initial: TabId = upcoming.length ? "upcoming" : deals.length ? "deals" : "past";
  const [tab, setTab] = useState<TabId>(initial);
  const [filters, setFilters] = useState<VenueListingFilterState>(
    VENUE_LISTING_FILTER_DEFAULTS,
  );

  const tabListings = tab === "upcoming" ? upcoming : tab === "deals" ? deals : past;

  // Reuse the explore feed's filter logic so a date window / category /
  // lifestyle / free filter means exactly what it does there. Type and venue
  // are already fixed (tabs + this page), so we only feed the active subset.
  const listings = useMemo(() => {
    const full: Filters = {
      type: "all",
      neighborhoods: [],
      categories: filters.categories,
      date: filters.date,
      from: filters.from,
      to: filters.to,
      lifestyle: filters.lifestyle,
      freeOnly: filters.freeOnly,
      sort: filters.sort,
      view: "grid",
      tab: "all",
      pageSize: 18,
    };
    return applyFilters(tabListings, full);
  }, [tabListings, filters]);

  return (
    <div>
      <div className="border-border mb-5 flex gap-1 border-b">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative -mb-px border-b-2 px-2 py-2.5 sm:px-4 text-[13px] font-medium transition-colors ${
                active
                  ? "border-dark text-dark"
                  : "text-graphite hover:text-dark border-transparent"
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                  active ? "bg-dark text-white" : "bg-tag-bg text-gray"
                }`}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}
      </div>
      <VenueListingFilterBar value={filters} onChange={setFilters} />
      <ListingGrid listings={listings} />
    </div>
  );
}
