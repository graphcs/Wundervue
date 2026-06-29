import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingBySlugAsync, getVenueTicketUrl } from "@/lib/data/listings.server";
import { ListingDetailView } from "@/components/detail/ListingDetailView";
import { MoreFromVenue } from "@/components/detail/MoreFromVenue";
import { InsiderLockedPreview } from "@/components/detail/InsiderLockedPreview";
import { canAccessListing } from "@/lib/auth/insiderGate";
import { getServerPlan } from "@/lib/auth/serverPlan";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlugAsync(slug);
  if (!listing || listing.type === "deal") return { title: "Event not found" };
  return {
    title: listing.title,
    description: listing.description,
    openGraph: {
      title: listing.title,
      description: listing.description,
      images: [listing.imageUrl],
      type: "article",
    },
  };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const listing = await getListingBySlugAsync(slug);
  if (!listing || listing.type === "deal") notFound();

  const venueTicketUrl = await getVenueTicketUrl(listing);

  const plan = await getServerPlan();
  const allowed = canAccessListing(listing, plan);

  return (
    <>
      <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 pb-2 pt-4">
        <Link
          href="/explore"
          className="text-graphite text-[13px] font-medium hover:underline"
        >
          ← Back to results
        </Link>
        <Link
          href="/explore"
          aria-label="Close"
          className="hover:bg-tag-bg text-gray flex h-8 w-8 items-center justify-center rounded-full transition-colors"
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
      </div>
      <div className="mx-auto max-w-[720px] px-5 pb-16">
        {allowed ? (
          <>
            <ListingDetailView listing={listing} variant="page" venueTicketUrl={venueTicketUrl} />
            <MoreFromVenue listing={listing} />
          </>
        ) : (
          <InsiderLockedPreview listing={listing} />
        )}
      </div>
    </>
  );
}
