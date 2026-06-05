"use client";

import Link from "next/link";
import type { Listing } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { InsiderBadge } from "@/components/ui/InsiderBadge";
import { FavButton } from "@/components/ui/FavButton";
import { DealTag } from "@/components/ui/DealTag";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { canAccessListing, isListingInsiderOnly } from "@/lib/auth/insiderGate";
import { LifestyleTagChips } from "@/components/ui/LifestyleTagChips";

interface Props {
  listing: Listing;
}

function CalendarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CardBody({ listing, locked }: { listing: Listing; locked: boolean }) {
  return (
    <>
      <div className="bg-tag-bg relative h-[150px] w-full overflow-hidden">
        <Badge type={listing.type} />
        {listing.isFree && <FreeBadge />}
        {isListingInsiderOnly(listing) && (
          <span className="absolute bottom-1.5 left-1.5 z-10">
            <InsiderBadge />
          </span>
        )}
        {!locked && <FavButton listingId={listing.id} tags={listing.tags} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          <span className="bg-tag-bg text-graphite rounded-full px-2.5 py-1 text-[11px] font-medium">
            {listing.neighborhood}
          </span>
          <span className="bg-tag-bg text-graphite rounded-full px-2.5 py-1 text-[11px] font-medium">
            {listing.category}
          </span>
        </div>
        {listing.tags && listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <LifestyleTagChips tags={listing.tags} size="sm" />
          </div>
        )}
        <h3 className="text-dark line-clamp-2 text-base font-medium leading-tight">
          {listing.title}
        </h3>
        <p className="text-gray line-clamp-2 text-[13px] leading-snug">
          {listing.description}
        </p>
        <div className="text-graphite mt-auto flex items-center gap-2 pt-1 text-xs">
          <CalendarIcon />
          <span className="font-medium">
            {listing.dateDisplay} · {listing.timeDisplay}
          </span>
          {listing.dealValue && (
            <span className="ml-auto">
              <DealTag value={listing.dealValue} />
            </span>
          )}
          {!listing.dealValue && (
            <span className="text-gray ml-auto text-[11px]">
              via {listing.source}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export function ListingCard({ listing }: Props) {
  const { profile, openUpgrade } = useAuthContext();
  const locked = !canAccessListing(listing, profile?.plan);
  const href =
    listing.type === "deal"
      ? `/deals/${listing.slug}`
      : `/events/${listing.slug}`;

  if (locked) {
    return (
      <button
        type="button"
        onClick={openUpgrade}
        aria-label={`Upgrade to view ${listing.title}`}
        className="group border-border relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <CardBody listing={listing} locked />
      </button>
    );
  }

  return (
    <Link
      href={href}
      className="group border-border relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <CardBody listing={listing} locked={false} />
    </Link>
  );
}
