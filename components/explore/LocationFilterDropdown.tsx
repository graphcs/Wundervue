"use client";

import { useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Popover, DropdownChevron } from "@/components/ui/Popover";
import { LOCATIONS, type DynamicCity } from "@/lib/data/locations";

interface Props {
  label?: string;
  /** Selected taxonomy slugs (region/city/neighborhood). */
  selected: string[];
  onToggle: (slug: string) => void;
  onClear?: () => void;
  /** Auto-discovered metro cities, rendered as leaves under their region. */
  dynamicCities?: readonly DynamicCity[];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function CheckBox({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
        on ? (dim ? "border-chrome bg-chrome" : "bg-dark border-dark") : "border-chrome bg-white"
      }`}
    >
      {on && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

interface RowProps {
  label: string;
  slug: string;
  depth: number;
  checked: boolean;
  /** Selected via an ancestor — shown checked but not directly toggleable. */
  implied: boolean;
  expandable: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
}

function Row({
  label,
  depth,
  checked,
  implied,
  expandable,
  expanded,
  onToggleExpand,
  onToggle,
}: RowProps) {
  return (
    <div
      className="hover:bg-tag-bg flex items-center gap-1.5 py-2 pr-3 text-sm"
      style={{ paddingLeft: 12 + depth * 16 }}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="text-graphite hover:text-dark flex h-4 w-4 items-center justify-center"
        >
          <Chevron open={expanded} />
        </button>
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
      <label className="flex flex-1 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked || implied}
          disabled={implied}
          onChange={onToggle}
          className="sr-only"
        />
        <CheckBox on={checked || implied} dim={implied} />
        <span className={implied ? "text-gray" : "text-dark"}>{label}</span>
      </label>
    </div>
  );
}

export function LocationFilterDropdown({
  label = "Location",
  selected,
  onToggle,
  onClear,
  dynamicCities = [],
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sel = new Set(selected);
  const isExpanded = (slug: string) => expanded.has(slug);
  const toggleExpand = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const count = selected.length;
  const displayLabel = count > 0 ? `${label} (${count})` : label;

  return (
    <Popover
      panelClassName="border-border max-h-[380px] min-w-[260px] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border bg-white py-1 shadow-lg"
      trigger={({ open, toggle }) => (
        <Pill active={count > 0} onClick={toggle}>
          {displayLabel}
          <DropdownChevron open={open} />
        </Pill>
      )}
    >
      {() => (
        <>
          {LOCATIONS[0].regions.map((region) => {
            const regionSelected = sel.has(region.slug);
            return (
              <div key={region.slug}>
                <Row
                  label={region.label}
                  slug={region.slug}
                  depth={0}
                  checked={regionSelected}
                  implied={false}
                  expandable={region.cities.length > 0}
                  expanded={isExpanded(region.slug)}
                  onToggleExpand={() => toggleExpand(region.slug)}
                  onToggle={() => onToggle(region.slug)}
                />
                {isExpanded(region.slug) && (
                  <>
                    {region.cities.map((city) => {
                      const citySelected = sel.has(city.slug);
                      const cityImplied = regionSelected;
                      const hasHoods = city.neighborhoods.length > 0;
                      return (
                        <div key={city.slug}>
                          <Row
                            label={city.label}
                            slug={city.slug}
                            depth={1}
                            checked={citySelected}
                            implied={cityImplied}
                            expandable={hasHoods}
                            expanded={isExpanded(city.slug)}
                            onToggleExpand={() => toggleExpand(city.slug)}
                            onToggle={() => onToggle(city.slug)}
                          />
                          {isExpanded(city.slug) &&
                            city.neighborhoods.map((hood) => (
                              <Row
                                key={hood.slug}
                                label={hood.label}
                                slug={hood.slug}
                                depth={2}
                                checked={sel.has(hood.slug)}
                                implied={regionSelected || citySelected}
                                expandable={false}
                                expanded={false}
                                onToggleExpand={() => {}}
                                onToggle={() => onToggle(hood.slug)}
                              />
                            ))}
                        </div>
                      );
                    })}
                    {/* Auto-discovered metro cities live under their region as leaves. */}
                    {dynamicCities
                      .filter((c) => c.regionSlug === region.slug)
                      .map((c) => (
                        <Row
                          key={c.slug}
                          label={c.label}
                          slug={c.slug}
                          depth={1}
                          checked={sel.has(c.slug)}
                          implied={regionSelected}
                          expandable={false}
                          expanded={false}
                          onToggleExpand={() => {}}
                          onToggle={() => onToggle(c.slug)}
                        />
                      ))}
                  </>
                )}
              </div>
            );
          })}
          {count > 0 && onClear && (
            <div className="border-border mt-1 border-t px-3 pt-2 pb-1">
              <button
                type="button"
                onClick={onClear}
                className="text-graphite hover:text-dark text-[12px] font-medium"
              >
                Clear locations
              </button>
            </div>
          )}
        </>
      )}
    </Popover>
  );
}
