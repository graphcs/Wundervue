"use client";

import type { Listing } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { FreeBadge } from "@/components/ui/FreeBadge";
import { InsiderBadge } from "@/components/ui/InsiderBadge";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { LifestyleTagChips } from "@/components/ui/LifestyleTagChips";

interface Props {
  listing: Listing;
}

// Renders a teaser of the listing (image, title, neighborhood, category) with
// the body locked behind an Insider CTA. Free users land here from the
// listing card; the actual access decision is made server-side in the route
// handler — this component is only rendered when the user can't access.
export function InsiderLockedPreview({ listing }: Props) {
  const { openUpgrade, isLoggedIn, openOnboarding } = useAuthContext();
  const onUpgrade = () => {
    if (isLoggedIn) openUpgrade();
    else openOnboarding(0);
  };

  return (
    <article className="flex flex-col">
      <div className="bg-tag-bg relative h-[360px] w-full overflow-hidden rounded-t-2xl">
        <Badge type={listing.type} />
        {listing.isFree && <FreeBadge />}
        <span className="absolute bottom-3 left-3 z-10">
          <InsiderBadge />
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="h-full w-full object-cover"
          style={{ filter: "brightness(0.6)" }}
        />
      </div>
      <div className="border-border rounded-b-2xl border border-t-0 px-5 py-6">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="bg-tag-bg text-graphite rounded-full px-2.5 py-1 text-[11px] font-medium">
            {listing.neighborhood}
          </span>
          <span className="bg-tag-bg text-graphite rounded-full px-2.5 py-1 text-[11px] font-medium">
            {listing.category}
          </span>
          <LifestyleTagChips tags={listing.tags} />
        </div>
        <h1 className="text-dark mb-2 text-[24px] font-medium leading-tight">
          {listing.title}
        </h1>
        <p className="text-gray text-[14px] leading-snug">
          {listing.dateDisplay} · {listing.timeDisplay}
        </p>

        <div className="border-coral mt-6 rounded-xl border-2 bg-white p-5 text-center">
          <h2 className="text-dark mb-1 text-[16px] font-medium">
            This is an Insider event
          </h2>
          <p className="text-gray mb-4 text-[13px]">
            Upgrade to Insider for full details, saves, and access to every
            curated lifestyle pick — date night, dog-friendly, family, outdoor.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="bg-dark rounded-pill w-full max-w-xs px-6 py-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            {isLoggedIn ? "Upgrade to Insider — $4.99/month" : "Sign up & Upgrade"}
          </button>
        </div>
      </div>
    </article>
  );
}
