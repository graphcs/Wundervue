"use client";

import { useState } from "react";
import Link from "next/link";
import type { ViewMode } from "@/lib/types";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useSavedListings } from "@/lib/hooks/useSavedListings";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { ListingGrid } from "@/components/explore/ListingGrid";
import { MapView } from "@/components/explore/MapView";
import { CalendarView } from "@/components/explore/CalendarView";
import { SavedViewToggle } from "@/components/explore/SavedViewToggle";

// The signed-in user's saved events, with the same Grid/Map/Calendar toggle as
// the account Saved tab (map/calendar are Insider-only). Reuses useFavorites +
// useSavedListings + the shared view components.
export function MyEvents() {
  const { isLoggedIn, profile, openOnboarding, openUpgrade } = useAuthContext();
  const isInsider = profile?.plan === "insider";
  const { favorites } = useFavorites();
  const { listings, loading } = useSavedListings(Array.from(favorites));
  const [view, setView] = useState<ViewMode>("grid");

  if (!isLoggedIn) {
    return (
      <div className="border-border rounded-2xl border bg-white p-10 text-center">
        <h2 className="text-dark text-[18px] font-medium">Sign in to see your saved events</h2>
        <p className="text-gray mx-auto mt-1.5 max-w-sm text-[14px]">
          Save events from the feed and they&apos;ll show up here.
        </p>
        <button
          type="button"
          onClick={() => openOnboarding(0)}
          className="bg-dark rounded-pill mt-5 px-6 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <>
      {listings.length > 0 && (
        <div className="mb-4 flex justify-end">
          <SavedViewToggle value={view} onChange={setView} isInsider={isInsider} onLocked={openUpgrade} />
        </div>
      )}
      {loading ? (
        <p className="text-gray text-[13px]">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="text-gray text-[13px]">
          Nothing saved yet.{" "}
          <Link href="/" className="text-coral font-medium hover:underline">
            Browse events
          </Link>
          .
        </p>
      ) : view === "map" ? (
        <MapView listings={listings} />
      ) : view === "calendar" ? (
        <CalendarView listings={listings} />
      ) : (
        <ListingGrid listings={listings} />
      )}
    </>
  );
}
