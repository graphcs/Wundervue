"use client";

import Link from "next/link";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFollowedVenues } from "@/lib/hooks/useFollowedVenues";
import { VENUES } from "@/lib/data/venues";
import { getListingsByVenueId } from "@/lib/data/listings";
import { SlideOver } from "./SlideOver";
import { PinIcon } from "@/components/detail/icons";

export function SavedVenuesPanel() {
  const { savedVenuesOpen, closeSavedVenues } = useAuthContext();
  const { followed, toggle } = useFollowedVenues();
  const venues = VENUES.filter((v) => followed.has(v.id));

  return (
    <SlideOver
      open={savedVenuesOpen}
      onClose={closeSavedVenues}
      title="Saved Venues"
      subtitle={`${venues.length} ${venues.length === 1 ? "venue" : "venues"}`}
    >
      {venues.length === 0 ? (
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
              <path d="M3 9.5 12 3l9 6.5V21a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h3 className="text-dark text-[15px] font-medium">
            No saved venues yet
          </h3>
          <p className="text-gray max-w-[260px] text-[13px]">
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
          {venues.map((v) => {
            const count = getListingsByVenueId(v.id).length;
            return (
              <li key={v.id} className="flex gap-3 px-5 py-4">
                <Link
                  href={`/venues/${v.slug}`}
                  onClick={closeSavedVenues}
                  className="flex flex-1 flex-col gap-1"
                >
                  <h3 className="text-dark text-[14px] font-medium leading-tight">
                    {v.name}
                  </h3>
                  <p className="text-graphite line-clamp-2 text-[12px] leading-snug">
                    {v.description}
                  </p>
                  <div className="text-gray mt-1 flex items-center gap-1 text-[12px]">
                    <PinIcon size={12} />
                    <span className="truncate">{v.address}</span>
                  </div>
                  <p className="text-coral mt-0.5 text-[12px] font-medium">
                    {count} active {count === 1 ? "listing" : "listings"}
                  </p>
                </Link>
                <button
                  type="button"
                  aria-label="Unfollow venue"
                  onClick={() => toggle(v.id)}
                  className="hover:bg-tag-bg text-gray flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            );
          })}
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
