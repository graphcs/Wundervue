"use client";

import { useState } from "react";
import type { Listing } from "@/lib/types";
import { ListingGrid } from "./ListingGrid";

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

  const listings = tab === "upcoming" ? upcoming : tab === "deals" ? deals : past;

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
      <ListingGrid listings={listings} />
    </div>
  );
}
