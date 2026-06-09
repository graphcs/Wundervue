"use client";

import { useState, type FormEvent } from "react";
import { useFilters } from "@/lib/hooks/useFilters";

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </svg>
  );
}

// AllTrails-style hero: a heading + a prominent centered search that drives the
// `q` filter (the feed below re-renders via the URL).
export function HomeHero() {
  const { filters, replaceFilters } = useFilters();
  const [q, setQ] = useState(filters.q ?? "");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Search is a global action: always land on the All feed so results show
    // even if the user is on the For You / My Events tab.
    replaceFilters({ q: q.trim() || undefined, tab: "all" });
  };

  return (
    <section className="bg-bg border-border border-b">
      <div className="mx-auto max-w-[760px] px-7 py-12 text-center sm:py-16">
        <h1 className="text-dark text-[30px] font-medium leading-tight sm:text-[40px]">
          Find your next thing to do in Denver
        </h1>
        <p className="text-gray mx-auto mt-2 max-w-md text-[15px]">
          Events, deals, and local happenings — all in one place.
        </p>
        <form onSubmit={onSubmit} className="relative mx-auto mt-6 max-w-[640px]">
          <span className="text-chrome pointer-events-none absolute left-5 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events, deals, neighborhoods…"
            aria-label="Search Denver events and deals"
            className="border-border text-dark placeholder:text-chrome focus:border-dark w-full rounded-pill border bg-white py-4 pl-12 pr-[120px] text-[15px] shadow-sm focus:outline-none"
          />
          <button
            type="submit"
            className="bg-dark rounded-pill absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Search
          </button>
        </form>
      </div>
    </section>
  );
}
