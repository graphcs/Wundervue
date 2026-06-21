import Link from "next/link";
import type { Venue } from "@/lib/types";
import { getListingsByVenueId } from "@/lib/data/listings";
import { venueCategoryLabel } from "@/lib/data/categories";
import { buildDirectionsUrl } from "@/lib/links";
import { FollowVenueButton } from "./FollowVenueButton";
import {
  CompassIcon,
  PinIcon,
} from "@/components/detail/icons";

interface Props {
  venue: Venue;
  showClose?: boolean;
  // Total listings at this venue. Provided by the DB-backed venue page; the
  // explore overlay omits it and falls back to the fixture count.
  listingCount?: number;
}

export function VenueHeader({ venue, showClose = false, listingCount }: Props) {
  const eventCount = listingCount ?? getListingsByVenueId(venue.id).length;
  const categories = venue.categories ?? [];

  return (
    <section className="border-border relative mb-6 rounded-2xl border bg-white px-4 py-5 sm:px-6">
      {showClose && (
        <Link
          href="/explore"
          aria-label="Clear venue filter"
          className="hover:bg-tag-bg text-gray absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        >
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
      )}

      <div className="flex flex-col gap-3 pr-12 sm:pr-10">
        <div>
          <h2 className="text-dark text-[18px] sm:text-[22px] font-medium leading-tight">
            {venue.name}
          </h2>
          <p className="text-gray mt-1 text-[13px]">
            {eventCount} {eventCount === 1 ? "listing" : "listings"} ·{" "}
            {venue.neighborhood}
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((slug) => (
              <span
                key={slug}
                className="bg-tag-bg text-graphite rounded-full px-2.5 py-1 text-[11px] font-medium"
              >
                {venueCategoryLabel(slug)}
              </span>
            ))}
          </div>
        )}

        <p className="text-graphite text-[14px] leading-relaxed">
          {venue.description}
        </p>

        <div className="flex flex-col gap-1.5">
          <div className="text-graphite inline-flex items-center gap-1.5 text-[13px]">
            <PinIcon size={13} className="text-gray" />
            {venue.address}
          </div>
          <a
            href={buildDirectionsUrl(venue.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
          >
            <CompassIcon size={13} />
            Get Directions
          </a>
        </div>

        <div className="mt-1">
          <FollowVenueButton venueId={venue.slug} />
        </div>
      </div>
    </section>
  );
}
