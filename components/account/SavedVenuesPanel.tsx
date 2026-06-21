"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFollowedVenues } from "@/lib/hooks/useFollowedVenues";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SlideOver } from "./SlideOver";
import { PinIcon } from "@/components/detail/icons";

interface FollowedVenue {
  id: string;
  slug: string;
  name: string;
  description: string;
  address: string;
  neighborhood: string;
  upcomingCount: number;
}

export function SavedVenuesPanel() {
  const { savedVenuesOpen, closeSavedVenues } = useAuthContext();
  const { followed, toggle } = useFollowedVenues();
  const [venues, setVenues] = useState<FollowedVenue[]>([]);
  const [loading, setLoading] = useState(false);

  const slugs = Array.from(followed);
  const key = slugs.slice().sort().join(",");

  useEffect(() => {
    if (!savedVenuesOpen || slugs.length === 0) {
      setVenues([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sb = getSupabaseBrowserClient();
      const { data: vRows, error } = await sb
        .from("venues")
        .select("id, slug, name, description, address, neighborhood")
        .in("slug", slugs);
      if (cancelled) return;
      if (error) {
        console.error("[SavedVenuesPanel] venues fetch failed", error);
        setVenues([]);
        setLoading(false);
        return;
      }
      const rows = (vRows ?? []) as Array<Omit<FollowedVenue, "upcomingCount">>;
      const ids = rows.map((v) => v.id);

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const counts = new Map<string, number>();
      if (ids.length > 0) {
        const { data: lRows } = await sb
          .from("listings")
          .select("venue_id")
          .in("venue_id", ids)
          .not("published_at", "is", null)
          .gte("date_start", today.toISOString());
        for (const r of (lRows ?? []) as Array<{ venue_id: string }>) {
          counts.set(r.venue_id, (counts.get(r.venue_id) ?? 0) + 1);
        }
      }
      if (cancelled) return;
      setVenues(
        rows
          .map((v) => ({ ...v, upcomingCount: counts.get(v.id) ?? 0 }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedVenuesOpen, key]);

  return (
    <SlideOver
      open={savedVenuesOpen}
      onClose={closeSavedVenues}
      title="Saved Venues"
      subtitle={`${slugs.length} ${slugs.length === 1 ? "venue" : "venues"}`}
    >
      {loading ? (
        <div className="text-gray flex items-center justify-center px-6 py-20 text-[13px]">
          Loading saved venues…
        </div>
      ) : venues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="bg-tag-bg flex h-14 w-14 items-center justify-center rounded-full">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86898a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5V21a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h3 className="text-dark text-[15px] font-medium">No saved venues yet</h3>
          <p className="text-gray w-full max-w-[260px] text-[13px]">
            Follow venues you love to keep track of their events and deals.
          </p>
          <Link
            href="/venues"
            onClick={closeSavedVenues}
            className="bg-dark rounded-pill mt-2 px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Explore Venues
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-border divide-y">
            {venues.map((v) => (
              <li key={v.slug} className="flex gap-3 px-5 py-4">
                <Link
                  href={`/venues/${v.slug}`}
                  onClick={closeSavedVenues}
                  className="flex flex-1 flex-col gap-1"
                >
                  <h3 className="text-dark text-[14px] font-medium leading-tight">{v.name}</h3>
                  {v.description && (
                    <p className="text-graphite line-clamp-2 text-[12px] leading-snug">{v.description}</p>
                  )}
                  <div className="text-gray mt-1 flex items-center gap-1 text-[12px]">
                    <PinIcon size={12} />
                    <span className="truncate">{v.address || v.neighborhood}</span>
                  </div>
                  <p className="text-coral mt-0.5 text-[12px] font-medium">
                    {v.upcomingCount} upcoming {v.upcomingCount === 1 ? "event" : "events"}
                  </p>
                </Link>
                <button
                  type="button"
                  aria-label="Unfollow venue"
                  onClick={() => toggle(v.slug)}
                  className="hover:bg-tag-bg text-gray flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-border flex justify-center border-t px-5 py-4">
            <Link
              href="/venues"
              onClick={closeSavedVenues}
              className="text-dark text-[13px] font-medium underline-offset-2 hover:underline"
            >
              Explore all venues
            </Link>
          </div>
        </>
      )}
    </SlideOver>
  );
}
