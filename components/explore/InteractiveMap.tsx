"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { Map as MapGL, Marker, Popup, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Listing, ListingType } from "@/lib/types";

const DENVER_CENTER = { longitude: -104.9903, latitude: 39.7392, zoom: 12 };
const TILE_STYLE = "https://tiles.openfreemap.org/styles/liberty";

type PinKind = ListingType | "mixed";

interface PinStyle {
  fill: string;
  ring: string;
}

// "mixed" = a stack of listings with more than one type at the same coord.
// It shares the "both" gray fill but adds a coral ring to distinguish it from
// a single listing that is itself type=both.
const PIN_STYLES: Record<PinKind, PinStyle> = {
  event: { fill: "#121821", ring: "#ffffff" },
  deal: { fill: "#ff535b", ring: "#ffffff" },
  both: { fill: "#6b7280", ring: "#ffffff" },
  mixed: { fill: "#6b7280", ring: "#ff535b" },
};

interface Props {
  listings: Listing[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}

interface PinGroup {
  key: string;
  lat: number;
  lng: number;
  listings: Listing[];
}

function hasCoords(l: Listing): boolean {
  return !(l.lat === 0 && l.lng === 0);
}

function detailHref(l: Listing): string {
  return l.type === "deal" ? `/deals/${l.slug}` : `/events/${l.slug}`;
}

// Pick a pin kind for a group of listings sharing one coord. A single type
// across the group → that type. Multiple types in the same stack → "mixed",
// which is rendered differently from a single listing of type=both.
function groupType(group: Listing[]): PinKind {
  const types = new Set(group.map((l) => l.type));
  if (types.size === 1) return [...types][0];
  return "mixed";
}

export function InteractiveMap({ listings, activeId, onActiveChange }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const mappable = useMemo(() => listings.filter(hasCoords), [listings]);

  // Group listings that share the same coordinate so stacked pins become a
  // single marker with a counter; clicking expands a list popup.
  const groups = useMemo<PinGroup[]>(() => {
    const m = new Map<string, PinGroup>();
    for (const l of mappable) {
      const key = `${l.lat.toFixed(6)},${l.lng.toFixed(6)}`;
      const existing = m.get(key);
      if (existing) existing.listings.push(l);
      else m.set(key, { key, lat: l.lat, lng: l.lng, listings: [l] });
    }
    return [...m.values()];
  }, [mappable]);

  const activeGroup = useMemo(() => {
    if (!activeId) return undefined;
    return groups.find((g) => g.listings.some((l) => l.id === activeId));
  }, [activeId, groups]);

  const initialViewState = useMemo(() => {
    if (groups.length === 0) return DENVER_CENTER;
    if (groups.length === 1) {
      return { longitude: groups[0].lng, latitude: groups[0].lat, zoom: 14 };
    }
    let minLng = groups[0].lng;
    let maxLng = groups[0].lng;
    let minLat = groups[0].lat;
    let maxLat = groups[0].lat;
    for (const g of groups) {
      if (g.lng < minLng) minLng = g.lng;
      if (g.lng > maxLng) maxLng = g.lng;
      if (g.lat < minLat) minLat = g.lat;
      if (g.lat > maxLat) maxLat = g.lat;
    }
    return {
      bounds: [
        [minLng, minLat],
        [maxLng, maxLat],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 64, maxZoom: 14 },
    };
  }, [groups]);

  return (
    <div className="relative h-full w-full">
      <MapGL
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={TILE_STYLE}
        onClick={() => onActiveChange(null)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {groups.map((g) => {
          const style = PIN_STYLES[groupType(g.listings)];
          const count = g.listings.length;
          return (
            <Marker
              key={g.key}
              longitude={g.lng}
              latitude={g.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onActiveChange(g.listings[0].id);
              }}
            >
              <button
                type="button"
                aria-label={
                  count === 1
                    ? g.listings[0].title
                    : `${count} listings at this location`
                }
                className="flex cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-bold text-white shadow"
                style={{
                  background: style.fill,
                  borderColor: style.ring,
                  width: count > 1 ? 22 : 16,
                  height: count > 1 ? 22 : 16,
                }}
              >
                {count > 1 ? count : ""}
              </button>
            </Marker>
          );
        })}

        {activeGroup && (
          <Popup
            longitude={activeGroup.lng}
            latitude={activeGroup.lat}
            anchor="bottom"
            offset={20}
            closeButton={false}
            closeOnClick={false}
            className="wv-map-popup"
          >
            {activeGroup.listings.length === 1 ? (
              <PopupCard listing={activeGroup.listings[0]} />
            ) : (
              <div className="flex max-h-[40vh] w-[240px] flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-sm">
                <div className="text-graphite px-1 text-[11px] font-medium">
                  {activeGroup.listings.length} at this location
                </div>
                {activeGroup.listings.map((l) => (
                  <PopupCard key={l.id} listing={l} compact />
                ))}
              </div>
            )}
          </Popup>
        )}
      </MapGL>

      <div className="border-border absolute left-4 top-4 z-20 flex items-center gap-3 rounded-full border bg-white/95 px-3 py-1.5 text-[10px] font-medium shadow-sm backdrop-blur">
        <LegendDot kind="event" label="Event" />
        <LegendDot kind="deal" label="Deal" />
        <LegendDot kind="both" label="Both" />
        <LegendDot kind="mixed" label="Mixed" />
      </div>
    </div>
  );
}

function LegendDot({ kind, label }: { kind: PinKind; label: string }) {
  const style = PIN_STYLES[kind];
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full border"
        style={{ background: style.fill, borderColor: style.ring }}
      />
      {label}
    </span>
  );
}

function PopupCard({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  return (
    <Link
      href={detailHref(listing)}
      className={
        compact
          ? "flex w-full gap-2.5 rounded-lg p-1.5 hover:bg-tag-bg"
          : "border-border flex w-[260px] gap-2.5 rounded-xl border bg-white p-2 hover:border-dark"
      }
    >
      <div
        className={`bg-tag-bg relative shrink-0 overflow-hidden rounded-md ${
          compact ? "h-12 w-14" : "h-16 w-20"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="bg-tag-bg text-graphite w-fit rounded-full px-2 py-0.5 text-[10px] font-medium">
          {listing.neighborhood}
        </span>
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
