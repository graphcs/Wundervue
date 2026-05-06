"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Listing, ListingType, ListingSource, LifestyleTag } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { DealTag } from "@/components/ui/DealTag";
import { SlideOver } from "./SlideOver";

interface DbListingRow {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string;
  venue_id: string | null;
  address: string | null;
  neighborhood: string | null;
  category: string | null;
  date_start: string | null;
  date_end: string | null;
  date_display: string | null;
  time_display: string | null;
  is_free: boolean;
  deal_value: string | null;
  image_url: string | null;
  source: string;
  source_url: string | null;
  tags: string[];
}

const LISTING_COLUMNS =
  "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags";

function rowToListing(row: DbListingRow): Listing {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type as ListingType,
    title: row.title,
    description: row.description,
    venueId: row.venue_id ?? "",
    venueName: "",
    address: row.address ?? "",
    neighborhood: row.neighborhood ?? "",
    category: row.category ?? "",
    startAt: row.date_start ?? "",
    endAt: row.date_end,
    dateDisplay: row.date_display ?? "",
    timeDisplay: row.time_display ?? "",
    isFree: row.is_free,
    dealValue: row.deal_value ?? undefined,
    imageUrl: row.image_url ?? "",
    source: row.source as ListingSource,
    sourceUrl: row.source_url ?? undefined,
    tags: (row.tags ?? []) as LifestyleTag[],
    lat: null,
    lng: null,
  };
}

function HeartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="#ff535b"
      stroke="#ff535b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function SavedEventsPanel() {
  const { savedEventsOpen, closeSavedEvents, profile } = useAuthContext();
  const { favorites, toggle } = useFavorites();
  const [saved, setSaved] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const favIds = Array.from(favorites);
  const favKey = favIds.sort().join(",");

  useEffect(() => {
    if (!savedEventsOpen || favIds.length === 0) {
      setSaved([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("listings")
        .select(LISTING_COLUMNS)
        .in("id", favIds);
      if (cancelled) return;
      if (error) {
        console.error("[SavedEventsPanel] fetch failed", error);
        setSaved([]);
      } else {
        setSaved((data as DbListingRow[]).map(rowToListing));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // favKey collapses the favorites Set into a stable dep so we don't
    // re-fetch on every render — only when the actual id list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedEventsOpen, favKey]);

  return (
    <SlideOver
      open={savedEventsOpen}
      onClose={closeSavedEvents}
      title="Saved Events"
      subtitle={`${saved.length} ${saved.length === 1 ? "item" : "items"}`}
    >
      {loading ? (
        <div className="text-gray flex items-center justify-center px-6 py-20 text-[13px]">
          Loading saved events…
        </div>
      ) : saved.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="bg-tag-bg flex h-14 w-14 items-center justify-center rounded-full">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#86898a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h3 className="text-dark text-[15px] font-medium">
            No saved events yet
          </h3>
          <p className="text-gray max-w-[260px] text-[13px]">
            Tap the heart on any event or deal to save it here for later.
          </p>
          <Link
            href="/explore"
            onClick={closeSavedEvents}
            className="bg-dark rounded-pill mt-2 px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {saved.map((l) => {
            const href =
              l.type === "deal" ? `/deals/${l.slug}` : `/events/${l.slug}`;
            return (
              <li key={l.id} className="flex gap-3 px-5 py-3">
                <Link
                  href={href}
                  onClick={closeSavedEvents}
                  className="group flex flex-1 gap-3"
                >
                  <div className="bg-tag-bg relative h-[80px] w-[100px] shrink-0 overflow-hidden rounded-md">
                    <Badge type={l.type} size="sm" />
                    {l.isFree && <FreeBadge size="sm" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.imageUrl}
                      alt={l.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                      <span className="bg-tag-bg text-graphite rounded-full px-2 py-0.5 text-[10px] font-medium">
                        {l.neighborhood}
                      </span>
                      {l.dealValue && <DealTag value={l.dealValue} />}
                    </div>
                    <h3 className="text-dark line-clamp-2 text-[13px] font-medium leading-tight">
                      {l.title}
                    </h3>
                    <p className="text-gray text-[11px]">
                      {l.dateDisplay} · {l.venueName}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  aria-label="Remove from saved"
                  onClick={() => toggle(l.id, { plan: profile?.plan })}
                  className="hover:bg-tag-bg flex h-8 w-8 items-center justify-center self-center rounded-full transition-colors"
                >
                  <HeartIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SlideOver>
  );
}
