import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Listing } from "@/lib/types";
import {
  getVenueBySlugAsync,
  getVenueListingsAllAsync,
} from "@/lib/data/listings.server";
import { VenueHeader } from "@/components/explore/VenueHeader";
import { VenueTabs } from "@/components/explore/VenueTabs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Reads cookies via the auth-aware Supabase client, so render per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlugAsync(slug);
  if (!venue) return { title: "Venue not found" };
  return {
    title: venue.name,
    description: venue.description,
    openGraph: { title: venue.name, description: venue.description, type: "website" },
  };
}

// A listing is "past" once its effective end (date_end ?? date_start) is before
// the start of today. Undated listings (perpetual deals) are never past.
function isPast(l: Listing, todayStart: number): boolean {
  const end = l.endAt ?? l.startAt;
  if (!end) return false;
  const t = Date.parse(end);
  return !Number.isNaN(t) && t < todayStart;
}

export default async function VenuePage({ params }: PageProps) {
  const { slug } = await params;
  const venue = await getVenueBySlugAsync(slug);
  if (!venue) notFound();

  const listings = await getVenueListingsAllAsync(slug);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const cutoff = todayStart.getTime();

  const live = listings.filter((l) => !isPast(l, cutoff));
  const past = listings.filter((l) => isPast(l, cutoff));
  const upcoming = live.filter((l) => l.type === "event" || l.type === "both");
  const deals = live.filter((l) => l.type === "deal" || l.type === "both");

  return (
    <>
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 pb-2 pt-4">
        <Link href="/venues" className="text-graphite text-[13px] font-medium hover:underline">
          ← Back to venues
        </Link>
        <Link
          href="/venues"
          aria-label="Close"
          className="hover:bg-tag-bg text-gray flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
      </div>
      <div className="mx-auto max-w-[1100px] px-5 pb-8 pt-2">
        <VenueHeader venue={venue} listingCount={listings.length} />
        <VenueTabs upcoming={upcoming} deals={deals} past={past} />
      </div>
    </>
  );
}
