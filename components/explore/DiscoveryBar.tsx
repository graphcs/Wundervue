"use client";

import { useState, type FormEvent } from "react";
import { Pill } from "@/components/ui/Pill";
import { MultiDropdownPill } from "./MultiDropdownPill";
import { DateDropdown } from "./DateDropdown";
import { useFilters } from "@/lib/hooks/useFilters";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { CATEGORIES } from "@/lib/data/categories";
import { LIFESTYLE_TAGS, TYPE_FILTERS } from "@/lib/filters/types";
import type { LifestyleTag, TypeFilter } from "@/lib/types";

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#fff" : "#121821"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function MapPinIcon({ active }: { active: boolean }) {
  // Pin body is coral (or white when active on dark bg); center hole shows through to button bg
  const pinColor = active ? "#fff" : "#ff535b";
  const holeColor = active ? "#121821" : "#fff";
  return (
    <svg width="12" height="14" viewBox="0 0 24 24">
      <path
        d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z"
        fill={pinColor}
      />
      <circle cx="12" cy="9" r="2.8" fill={holeColor} />
    </svg>
  );
}

interface ViewToggleProps {
  value: "grid" | "map";
  onChange: (v: "grid" | "map") => void;
  mapDisabled?: boolean;
}

function ViewToggle({ value, onChange, mapDisabled = false }: ViewToggleProps) {
  const base =
    "inline-flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap";
  return (
    <div className="rounded-pill border-[1.5px] border-[#d0d0d0] bg-white overflow-hidden inline-flex">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`${base} ${
          value === "grid" ? "bg-dark text-white" : "text-graphite hover:text-dark"
        }`}
      >
        <GridIcon active={value === "grid"} />
        Grid
      </button>
      <button
        type="button"
        onClick={() => !mapDisabled && onChange("map")}
        disabled={mapDisabled}
        title={mapDisabled ? "Map view — coming in Slice 3" : undefined}
        className={`${base} ${
          value === "map" ? "bg-dark text-white" : "text-graphite hover:text-dark"
        } ${mapDisabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <MapPinIcon active={value === "map"} />
        Map
      </button>
    </div>
  );
}

export function DiscoveryBar() {
  const {
    filters,
    pathNeighborhood,
    pathCategory,
    replaceFilters,
    toggleLifestyle,
    toggleNeighborhood,
    toggleCategory,
  } = useFilters();
  const { profile, isLoggedIn, openUpgrade } = useAuthContext();
  const lifestyleGated = !isLoggedIn || profile?.plan !== "insider";

  const [q, setQ] = useState(filters.q ?? "");

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    replaceFilters({ q: q.trim() || undefined });
  };

  const hoodOptions = NEIGHBORHOODS.filter((n) => n.slug !== pathNeighborhood);
  const catOptions = CATEGORIES.filter((c) => c.slug !== pathCategory);

  return (
    <div className="bg-bg border-border border-b">
      <div className="mx-auto max-w-[1100px] px-7 pb-3 pt-4">
        <form onSubmit={onSearchSubmit} className="mb-3 flex gap-2.5">
          <div className="relative flex-1">
            <span className="text-chrome pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="Search events, deals, and things to do in Denver..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border-border text-dark placeholder:text-chrome rounded-pill w-full border bg-white py-3 pl-11 pr-4 text-sm focus:border-dark focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="bg-dark rounded-pill px-6 py-3 text-xs font-medium uppercase tracking-wider text-white hover:opacity-90"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <Pill
              key={t.id}
              active={filters.type === t.id}
              onClick={() =>
                replaceFilters({
                  type:
                    t.id === "all"
                      ? "all"
                      : filters.type === t.id
                        ? "all"
                        : (t.id as TypeFilter),
                })
              }
            >
              {t.label}
            </Pill>
          ))}

          <div className="mx-1.5 h-[18px] w-px bg-[#d5d5d5]" />

          <DateDropdown
            value={filters.date}
            from={filters.from}
            to={filters.to}
            onChange={({ date, from, to }) =>
              replaceFilters({ date, from, to })
            }
          />

          <MultiDropdownPill
            label="Neighborhood"
            options={hoodOptions}
            selected={filters.neighborhoods.filter(
              (s) => s !== pathNeighborhood,
            )}
            onToggle={toggleNeighborhood}
          />

          <MultiDropdownPill
            label="Category"
            options={catOptions}
            selected={filters.categories.filter((s) => s !== pathCategory)}
            onToggle={toggleCategory}
          />

          <div className="mx-1.5 h-[18px] w-px bg-[#d5d5d5]" />

          {LIFESTYLE_TAGS.map((tag) => (
            <Pill
              key={tag.id}
              active={filters.lifestyle.includes(tag.id)}
              onClick={() => {
                if (lifestyleGated) {
                  openUpgrade();
                  return;
                }
                toggleLifestyle(tag.id as LifestyleTag);
              }}
              title={lifestyleGated ? "Lifestyle filters — Insider only" : undefined}
            >
              <span className="text-[13px] leading-none">{tag.emoji}</span>
              {tag.label}
            </Pill>
          ))}

          <Pill
            active={filters.freeOnly}
            onClick={() => replaceFilters({ freeOnly: !filters.freeOnly })}
          >
            Free Only
          </Pill>

          <div className="ml-auto">
            <ViewToggle
              value={filters.view}
              onChange={(v) => replaceFilters({ view: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
