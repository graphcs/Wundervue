"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Listing } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { InteractiveMap } from "./InteractiveMap";

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

  // Debounce hover so a fast scroll through the sidebar doesn't fire
  // setActiveId once per card.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  const onHover = useCallback((id: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (id === null) {
      setActiveId(null);
      return;
    }
    hoverTimer.current = setTimeout(() => setActiveId(id), 80);
  }, []);

  return (
    <div
      className="border-border grid overflow-hidden rounded-2xl border bg-white"
      style={{ gridTemplateColumns: "380px 1fr", height: "calc(100vh - 220px)", minHeight: 600 }}
    >
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
                onHover={onHover}
              />
            ))}
          </div>
        )}
      </aside>

      <div className="relative">
        <InteractiveMap
          listings={listings}
          activeId={activeId}
          onActiveChange={setActiveId}
        />
      </div>
    </div>
  );
}
