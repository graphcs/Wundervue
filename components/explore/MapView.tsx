"use client";

import Link from "next/link";
import { useState } from "react";
import type { Listing, ListingType } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";

// Placeholder positions for fixture listings (ids "1"–"12"). Real lat/lng-based
// positioning lands when the Mapbox/Google Maps integration ships. Listings
// without a key here (e.g. scraped UUID-keyed rows) are skipped on the map.
const MAP_POSITIONS: Record<string, { top: string; left: string }> = {
  "1": { top: "22%", left: "62%" },
  "2": { top: "18%", left: "24%" },
  "3": { top: "28%", left: "35%" },
  "4": { top: "12%", left: "80%" },
  "5": { top: "65%", left: "60%" },
  "6": { top: "48%", left: "40%" },
  "7": { top: "20%", left: "20%" },
  "8": { top: "55%", left: "30%" },
  "9": { top: "72%", left: "48%" },
  "10": { top: "45%", left: "44%" },
  "11": { top: "30%", left: "32%" },
  "12": { top: "25%", left: "58%" },
};

const HOOD_LABELS = [
  { name: "LoHi", top: "16%", left: "18%" },
  { name: "RiNo", top: "20%", left: "56%" },
  { name: "Highlands", top: "30%", left: "28%" },
  { name: "Downtown", top: "46%", left: "36%" },
  { name: "Capitol Hill", top: "52%", left: "26%" },
  { name: "Cherry Creek", top: "63%", left: "55%" },
  { name: "Wash Park", top: "70%", left: "42%" },
  { name: "Baker", top: "60%", left: "20%" },
  { name: "Golden", top: "10%", left: "78%" },
];

const PIN_COLORS: Record<ListingType, string> = {
  event: "#121821",
  deal: "#ff535b",
  both: "#6b7280",
};

function PinMarker({ type }: { type: ListingType }) {
  const bg = PIN_COLORS[type];
  let iconPath: React.ReactNode;
  if (type === "event") {
    // Outlined calendar: rounded rect body + header divider + two pegs on top
    iconPath = (
      <g fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <rect x="11" y="11.5" width="10" height="8.5" rx="1.3" />
        <line x1="11" y1="14" x2="21" y2="14" />
        <line x1="13.8" y1="10" x2="13.8" y2="11.8" />
        <line x1="18.2" y1="10" x2="18.2" y2="11.8" />
      </g>
    );
  } else if (type === "deal") {
    // Solid percent symbol via text
    iconPath = (
      <text
        x="16"
        y="19"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="900"
        fill="#fff"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >
        %
      </text>
    );
  } else {
    // Solid star
    iconPath = (
      <g transform="translate(16 14.5) scale(0.82) translate(-16 -14.5)">
        <polygon
          points="16 8 17.9 12.6 23 13 19 16.2 20.2 21 16 18.4 11.8 21 13 16.2 9 13 14.1 12.6"
          fill="#fff"
        />
      </g>
    );
  }

  return (
    <svg width="32" height="40" viewBox="0 0 32 40" className="drop-shadow-md">
      <path
        d="M16 1 C7.716 1 1 7.716 1 16 C1 22.75 5.5 28.3 11.05 33.1 C13 34.8 14.7 36.7 16 39 C17.3 36.7 19 34.8 20.95 33.1 C26.5 28.3 31 22.75 31 16 C31 7.716 24.284 1 16 1 Z"
        fill={bg}
      />
      {iconPath}
    </svg>
  );
}

interface Props {
  listings: Listing[];
}

function CompactCard({
  listing,
  active,
  onHover,
}: {
  listing: Listing;
  active: boolean;
  onHover: (id: string | null) => void;
}) {
  const href =
    listing.type === "deal"
      ? `/deals/${listing.slug}`
      : `/events/${listing.slug}`;
  return (
    <Link
      href={href}
      onMouseEnter={() => onHover(listing.id)}
      onMouseLeave={() => onHover(null)}
      className={`group border-border flex gap-3 rounded-xl border p-2.5 pr-4 transition-all ${
        active ? "border-dark shadow-md" : "bg-white hover:border-dark"
      }`}
    >
      <div className="bg-tag-bg relative h-20 w-[110px] shrink-0 overflow-hidden rounded-md">
        <Badge type={listing.type} size="sm" />
        {listing.isFree && <FreeBadge size="sm" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <div className="flex gap-1.5">
          <span className="bg-tag-bg text-graphite rounded-full px-2 py-0.5 text-[10px] font-medium">
            {listing.neighborhood}
          </span>
        </div>
        <h3 className="text-dark line-clamp-2 text-[13px] font-medium leading-tight">
          {listing.title}
        </h3>
        <p className="text-gray text-[11px]">
          {listing.dateDisplay} · {listing.timeDisplay}
        </p>
      </div>
    </Link>
  );
}

export function MapView({ listings }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="border-border grid overflow-hidden rounded-2xl border bg-white" style={{ gridTemplateColumns: "380px 1fr", height: "calc(100vh - 220px)", minHeight: 600 }}>
      <aside className="border-border overflow-y-auto border-r px-4 py-3">
        {listings.length === 0 ? (
          <p className="text-gray px-3 py-6 text-sm">No results.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {listings.map((l) => (
              <CompactCard
                key={l.id}
                listing={l}
                active={activeId === l.id}
                onHover={setActiveId}
              />
            ))}
          </div>
        )}
      </aside>

      <div className="relative overflow-hidden" style={{ background: "#e8edf1" }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c9d2d9" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapgrid)" />
        </svg>

        {HOOD_LABELS.map((h) => (
          <span
            key={h.name}
            className="pointer-events-none absolute text-[10px] font-medium uppercase tracking-[0.12em] text-[#a0a8b0]"
            style={{ top: h.top, left: h.left }}
          >
            {h.name}
          </span>
        ))}

        <div className="border-border absolute left-4 top-4 z-20 flex items-center gap-3 rounded-full border bg-white/95 px-3 py-1.5 text-[10px] font-medium shadow-sm backdrop-blur">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-dark" /> Event
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIN_COLORS.deal }} /> Deal
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIN_COLORS.both }} /> Both
          </span>
        </div>

        {listings.map((l) => {
          const pos = MAP_POSITIONS[l.id];
          if (!pos) return null;
          const isActive = activeId === l.id;
          const href =
            l.type === "deal" ? `/deals/${l.slug}` : `/events/${l.slug}`;
          return (
            <Link
              key={l.id}
              href={href}
              aria-label={l.title}
              onMouseEnter={() => setActiveId(l.id)}
              onMouseLeave={() => setActiveId(null)}
              className={`absolute -translate-x-1/2 transition-transform ${
                isActive ? "z-10 scale-110" : "hover:scale-105"
              }`}
              style={{
                top: pos.top,
                left: pos.left,
                transformOrigin: "50% 100%",
                // Anchor the pin's point (the bottom tip) to the lat/lng position
                marginTop: -40,
              }}
            >
              <PinMarker type={l.type} />
            </Link>
          );
        })}

        <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg border-border border bg-white/95 shadow-sm">
          <button
            type="button"
            aria-label="Zoom in"
            className="hover:bg-tag-bg flex h-8 w-8 items-center justify-center text-lg leading-none"
          >
            +
          </button>
          <div className="h-px bg-border" />
          <button
            type="button"
            aria-label="Zoom out"
            className="hover:bg-tag-bg flex h-8 w-8 items-center justify-center text-lg leading-none"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}
