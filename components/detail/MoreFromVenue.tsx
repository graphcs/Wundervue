import Link from "next/link";
import type { Listing } from "@/lib/types";
import { getListingsByVenueSlugAsync } from "@/lib/data/listings.server";
import { Badge } from "@/components/ui/Badge";

interface Props {
  listing: Listing;
}

// Server component: only rendered for accessible listings, so it fetches the
// venue's other listings itself — no wasted query on the gated/locked path.
// Upcoming-only (a discovery rail, not the venue page's archive), so it uses
// the merged-feed reader rather than getVenueListingsAllAsync (includes past).
export async function MoreFromVenue({ listing }: Props) {
  if (!listing.venueId) return null;
  const others = (await getListingsByVenueSlugAsync(listing.venueId)).filter(
    (l) => l.id !== listing.id,
  );

  if (others.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-dark mb-4 text-xl font-medium">
        More from {listing.venueName}
      </h2>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {others.map((r) => {
          const href = r.type === "deal" ? `/deals/${r.slug}` : `/events/${r.slug}`;
          return (
            <Link
              key={r.id}
              href={href}
              className="border-border group relative flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="bg-tag-bg relative h-[130px] overflow-hidden">
                <Badge type={r.type} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.imageUrl}
                  alt={r.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1 px-3 py-2.5">
                <h3 className="text-dark line-clamp-2 text-sm font-medium">
                  {r.title}
                </h3>
                <p className="text-gray text-[11px]">
                  {r.dateDisplay} · {r.timeDisplay}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
