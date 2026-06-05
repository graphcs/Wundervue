import type { Listing, ListingType, ListingSource, LifestyleTag } from "@/lib/types";

// Column set + row→Listing mapper for browser-side reads of saved listings
// (account Saved/Calendar tabs via useSavedListings). Server reads use the
// richer mappers in lib/data/*.server.ts (those also resolve venue names).
export const SAVED_LISTING_COLUMNS =
  "id, slug, type, title, description, venue_id, address, neighborhood, category, date_start, date_end, date_display, time_display, is_free, deal_value, image_url, source, source_url, tags, lat, lng";

export function rowToListing(r: Record<string, unknown>): Listing {
  return {
    id: r.id as string, slug: r.slug as string, type: r.type as ListingType, title: r.title as string,
    description: (r.description as string) ?? "", venueId: (r.venue_id as string) ?? "", venueName: "",
    address: (r.address as string) ?? "", neighborhood: (r.neighborhood as string) ?? "", category: (r.category as string) ?? "",
    startAt: (r.date_start as string) ?? "", endAt: (r.date_end as string) ?? null, dateDisplay: (r.date_display as string) ?? "",
    timeDisplay: (r.time_display as string) ?? "", isFree: Boolean(r.is_free), dealValue: (r.deal_value as string) ?? undefined,
    imageUrl: (r.image_url as string) ?? "", source: r.source as ListingSource, sourceUrl: (r.source_url as string) ?? undefined,
    tags: ((r.tags as string[]) ?? []) as LifestyleTag[],
    lat: (r.lat as number | null) ?? null, lng: (r.lng as number | null) ?? null,
  };
}
