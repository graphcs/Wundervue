import type { Listing } from "@/lib/types";
import { categorySlug } from "@/lib/data/categories";
import { buildWanted, scoreFields, type ProfilePrefs, type Wanted } from "@/lib/data/profileTaxonomy";

export type RecoProfile = ProfilePrefs;

// Behavioral signals — what filters can't express. Followed venues are a strong
// intent signal; the saved-history sets capture learned taste from past saves.
export interface ForYouBehavior {
  savedIds: Set<string>; // excluded from the feed (already saved)
  followedVenues: Set<string>; // venue slugs (listing.venueId holds the slug)
  savedCategorySlugs: Set<string>; // categories the user tends to save
  savedNeighborhoods: Set<string>; // neighborhoods the user tends to save
}

// Build the behavior object from raw signals + the full listing set: derives the
// category/neighborhood taste sets from the user's saved listings.
export function buildForYouBehavior(
  signals: { savedIds: Set<string>; followedVenues: Set<string> },
  allListings: readonly Listing[],
): ForYouBehavior {
  const byId = new Map(allListings.map((l) => [l.id, l]));
  const savedCategorySlugs = new Set<string>();
  const savedNeighborhoods = new Set<string>();
  for (const id of signals.savedIds) {
    const saved = byId.get(id);
    if (!saved) continue;
    const slug = saved.category ? categorySlug(saved.category) : undefined;
    if (slug) savedCategorySlugs.add(slug);
    if (saved.neighborhood) savedNeighborhoods.add(saved.neighborhood);
  }
  return {
    savedIds: signals.savedIds,
    followedVenues: signals.followedVenues,
    savedCategorySlugs,
    savedNeighborhoods,
  };
}

function scoreWith(listing: Listing, w: Wanted, behavior?: ForYouBehavior): number {
  let score = scoreFields(listing, w); // stated prefs (category/neighborhood/tags/free)
  if (behavior) {
    if (listing.venueId && behavior.followedVenues.has(listing.venueId)) score += 4;
    const slug = listing.category ? categorySlug(listing.category) : undefined;
    if (slug && behavior.savedCategorySlugs.has(slug)) score += 2;
    if (listing.neighborhood && behavior.savedNeighborhoods.has(listing.neighborhood)) score += 2;
  }
  return score;
}

// Relevance score for the "For You" feed (stated prefs only; behavior is applied
// in rankForYou). Higher = more relevant.
export function scoreListing(listing: Listing, profile: RecoProfile): number {
  return scoreFields(listing, buildWanted(profile));
}

// Per-listing "Because you…" explanation, strongest signal first. Returns null
// when nothing specific drove it (a soonest-order filler).
export function forYouReason(listing: Listing, w: Wanted, behavior?: ForYouBehavior): string | null {
  if (listing.venueId && behavior?.followedVenues.has(listing.venueId)) {
    return `Because you follow ${listing.venueName || "this venue"}`;
  }
  const slug = listing.category ? categorySlug(listing.category) : undefined;
  if (
    behavior &&
    ((slug && behavior.savedCategorySlugs.has(slug)) ||
      (listing.neighborhood && behavior.savedNeighborhoods.has(listing.neighborhood)))
  ) {
    return "More like events you've saved";
  }
  if (scoreFields(listing, w) > 0) return "Matches your interests";
  return null;
}

// id → reason for a set of listings (omits listings with no specific reason).
// Takes a pre-built Wanted so the caller can share it with rankForYouWith.
export function forYouReasons(
  listings: readonly Listing[],
  w: Wanted,
  behavior?: ForYouBehavior,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of listings) {
    const reason = forYouReason(l, w, behavior);
    if (reason) out[l.id] = reason;
  }
  return out;
}

// Rank listings best-first using a pre-built Wanted. Already-saved listings are
// dropped. Stable: equal scores preserve input order (the feed is soonest-first),
// so ties fall back to "soonest".
export function rankForYouWith(
  listings: readonly Listing[],
  w: Wanted,
  behavior?: ForYouBehavior,
): Listing[] {
  return listings
    .filter((l) => !behavior?.savedIds.has(l.id))
    .map((listing, index) => ({ listing, index, score: scoreWith(listing, w, behavior) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.listing);
}

// Convenience wrapper that builds Wanted from a profile.
export function rankForYou(
  listings: readonly Listing[],
  profile: RecoProfile,
  behavior?: ForYouBehavior,
): Listing[] {
  return rankForYouWith(listings, buildWanted(profile), behavior);
}
