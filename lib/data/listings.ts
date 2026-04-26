import type { Listing } from "@/lib/types";

// Fixture events removed — /explore reads exclusively from Supabase. The
// helpers below preserve the original (sync) API for any client component that
// still imports it, but they no longer return seed data. Server-side code
// should query via lib/data/listings.server.ts (getPublishedListings,
// getListingBySlugAsync) for live scraped data.
export const LISTINGS: Listing[] = [];

const BY_SLUG = new Map(LISTINGS.map((l) => [l.slug, l]));

export function getListingBySlug(slug: string): Listing | undefined {
  return BY_SLUG.get(slug);
}

export function getListingsByVenueId(venueId: string): Listing[] {
  return LISTINGS.filter((l) => l.venueId === venueId);
}
