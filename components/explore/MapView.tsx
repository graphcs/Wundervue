"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Listing } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { InsiderBadge } from "@/components/ui/InsiderBadge";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { canAccessListing, isListingInsiderOnly } from "@/lib/auth/insiderGate";
import { InteractiveMap } from "./InteractiveMap";

interface Props {
  listings: Listing[];
}

function CompactCardBody({ listing }: { listing: Listing }) {
  return (
    <>
      <div className="bg-tag-bg relative h-20 w-[110px] shrink-0 overflow-hidden rounded-md">
        <Badge type={listing.type} size="sm" />
        {listing.isFree && <FreeBadge size="sm" />}
        {isListingInsiderOnly(listing) && (
          <span className="absolute bottom-1 left-1 z-10">
            <InsiderBadge size="sm" />
          </span>
        )}
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
    </>
  );
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
  const { profile, openUpgrade } = useAuthContext();
  const locked = !canAccessListing(listing, profile?.plan);
  const href =
    listing.type === "deal"
      ? `/deals/${listing.slug}`
      : `/events/${listing.slug}`;
  const className = `group border-border flex gap-3 rounded-xl border p-2.5 pr-4 transition-all text-left ${
    active ? "border-dark shadow-md" : "bg-white hover:border-dark"
  }`;

  if (locked) {
    return (
      <button
        type="button"
        onClick={openUpgrade}
        onMouseEnter={() => onHover(listing.id)}
        onMouseLeave={() => onHover(null)}
        aria-label={`Upgrade to view ${listing.title}`}
        className={className}
      >
        <CompactCardBody listing={listing} />
      </button>
    );
  }

  return (
    <Link
      href={href}
      onMouseEnter={() => onHover(listing.id)}
      onMouseLeave={() => onHover(null)}
      className={className}
    >
      <CompactCardBody listing={listing} />
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
    <div className="border-border grid min-h-[60vh] grid-cols-1 overflow-hidden rounded-2xl border bg-white lg:h-[calc(100vh-220px)] lg:min-h-[600px] lg:grid-cols-[380px_1fr]">
      <aside className="border-border max-h-[60vh] overflow-y-auto border-b px-4 py-3 lg:max-h-none lg:border-b-0 lg:border-r">
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

      <div className="relative h-[60vh] lg:h-auto">
        <InteractiveMap
          listings={listings}
          activeId={activeId}
          onActiveChange={setActiveId}
        />
      </div>
    </div>
  );
}
