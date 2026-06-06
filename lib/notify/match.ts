import { matchesProfile, type ListingFields, type ProfilePrefs } from "@/lib/data/profileTaxonomy";

// Notification audience match — same vocabulary mapping as the For You feed
// (shared via profileTaxonomy). A user with no prefs matches everything;
// otherwise they match on any category/neighborhood/tag overlap.
export type MatchProfile = ProfilePrefs;
export type MatchListing = ListingFields;

export function listingMatchesProfile(listing: MatchListing, profile: MatchProfile): boolean {
  return matchesProfile(listing, profile);
}
