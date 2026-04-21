import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VENUES, getVenueBySlug } from "@/lib/data/venues";
import { getListingsByVenueId } from "@/lib/data/listings";
import { VenueHeader } from "@/components/explore/VenueHeader";
import { ListingGrid } from "@/components/explore/ListingGrid";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return VENUES.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = getVenueBySlug(slug);
  if (!venue) return { title: "Venue not found" };
  return {
    title: venue.name,
    description: venue.description,
    openGraph: {
      title: venue.name,
      description: venue.description,
      type: "website",
    },
  };
}

export default async function VenuePage({ params }: PageProps) {
  const { slug } = await params;
  const venue = getVenueBySlug(slug);
  if (!venue) notFound();

  const listings = getListingsByVenueId(venue.id);

  return (
    <>
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 pb-2 pt-4">
        <Link
          href="/explore"
          className="text-graphite text-[13px] font-medium hover:underline"
        >
          ← Back to explore
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
      <div className="mx-auto max-w-[1100px] px-5 pb-8 pt-2">
        <VenueHeader venue={venue} />
        <ListingGrid listings={listings} />
      </div>
    </>
  );
}
