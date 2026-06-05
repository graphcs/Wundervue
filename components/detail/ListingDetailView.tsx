import Link from "next/link";
import type { Listing } from "@/lib/types";
import { getVenue } from "@/lib/data/venues";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { DealTag } from "@/components/ui/DealTag";
import { buildCalendarUrl, buildDirectionsUrl } from "@/lib/links";
import { LifestyleTagChips } from "@/components/ui/LifestyleTagChips";
import { FavoriteToggle } from "./FavoriteToggle";
import { ShareButton } from "./ShareButton";
import {
  CalendarIcon,
  CompassIcon,
  HouseIcon,
  PinIcon,
} from "./icons";

interface Props {
  listing: Listing;
  variant: "panel" | "page";
  onClose?: () => void;
}

function InfoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-gray mb-0.5 text-[10px] font-medium uppercase tracking-[0.1em]">
      {children}
    </div>
  );
}

export function ListingDetailView({ listing, variant, onClose }: Props) {
  const venue = getVenue(listing.venueId);
  const heroHeight = variant === "page" ? "h-[360px]" : "h-[240px]";
  const fullPageHref =
    listing.type === "deal"
      ? `/deals/${listing.slug}`
      : `/events/${listing.slug}`;

  return (
    <article className="flex flex-col">
      <div className={`bg-tag-bg relative ${heroHeight} w-full overflow-hidden`}>
        <Badge type={listing.type} />
        {listing.isFree && <FreeBadge />}
        {variant === "panel" && onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-transform hover:scale-105"
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
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-tag-bg text-graphite rounded-full px-3 py-1 text-[11px] font-medium">
            {listing.neighborhood}
          </span>
          <span className="bg-tag-bg text-graphite rounded-full px-3 py-1 text-[11px] font-medium">
            {listing.category}
          </span>
          {listing.dealValue && <DealTag value={listing.dealValue} />}
          <LifestyleTagChips tags={listing.tags} />
        </div>

        <h1
          className={
            variant === "page"
              ? "text-dark text-[28px] font-medium leading-tight"
              : "text-dark text-[22px] font-medium leading-tight"
          }
        >
          {listing.title}
        </h1>

        <p className="text-graphite text-[15px] leading-relaxed">
          {listing.description}
        </p>

        {venue && (
          <div className="flex flex-col gap-1">
            <Link
              href={`/venues/${venue.slug}`}
              className="text-coral inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <HouseIcon size={13} />
              {venue.name}
            </Link>
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
        )}

        <div className="flex flex-col gap-3 rounded-[10px] bg-[#f9f9f9] px-4 py-3.5">
          <div className="flex items-start justify-between">
            <div>
              <InfoLabel>Date</InfoLabel>
              <div className="text-dark text-sm font-medium">
                {listing.dateDisplay}
              </div>
            </div>
            <div className="text-right">
              <InfoLabel>Time</InfoLabel>
              <div className="text-dark text-sm font-medium">
                {listing.timeDisplay}
              </div>
            </div>
          </div>
          <div>
            <InfoLabel>Venue</InfoLabel>
            <div className="text-dark text-sm font-medium">
              {listing.venueName}
            </div>
          </div>
        </div>

        <div className="flex items-stretch gap-2.5">
          <FavoriteToggle listingId={listing.id} />
          <ShareButton listing={listing} />
        </div>

        <a
          href={buildCalendarUrl(listing)}
          target="_blank"
          rel="noopener noreferrer"
          className="border-dark text-dark hover:bg-dark rounded-pill inline-flex items-center justify-center gap-2 border-[1.5px] bg-white px-4 py-3 text-[13px] font-medium transition-colors hover:text-white"
        >
          <CalendarIcon size={14} />
          Save to Google Calendar
        </a>

        {variant === "panel" && (
          <button
            type="button"
            onClick={() => {
              window.location.href = fullPageHref;
            }}
            className="text-gray py-2 text-[13px] font-medium transition-colors hover:text-dark"
          >
            View Full Page →
          </button>
        )}

        <div className="border-border border-t pt-4">
          <InfoLabel>Source</InfoLabel>
          <a
            href={listing.sourceUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
          >
            View original post on {listing.source} ↗
          </a>
        </div>
      </div>
    </article>
  );
}
