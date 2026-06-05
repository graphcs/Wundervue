// Best-effort relevance match between a listing and a user's stated prefs, used
// by the personalized notification jobs (new drops / weekly recs). A user with
// no prefs set matches everything (so they still get value); otherwise a
// listing matches on category∈interests, neighborhood∈neighborhoods, or a tag
// overlap with lifestyle.
export interface MatchProfile {
  interests?: string[] | null;
  neighborhoods?: string[] | null;
  lifestyle?: string[] | null;
}
export interface MatchListing {
  category?: string | null;
  neighborhood?: string | null;
  neighborhoodSlug?: string | null;
  tags?: string[] | null;
}

function overlaps(a: string[], b: string[]): boolean {
  return a.some((x) => b.includes(x));
}

export function listingMatchesProfile(listing: MatchListing, profile: MatchProfile): boolean {
  const interests = profile.interests ?? [];
  const neighborhoods = profile.neighborhoods ?? [];
  const lifestyle = profile.lifestyle ?? [];
  if (interests.length === 0 && neighborhoods.length === 0 && lifestyle.length === 0) {
    return true;
  }
  if (listing.category && interests.includes(listing.category)) return true;
  if (
    (listing.neighborhoodSlug && neighborhoods.includes(listing.neighborhoodSlug)) ||
    (listing.neighborhood && neighborhoods.includes(listing.neighborhood))
  ) {
    return true;
  }
  if (listing.tags && lifestyle.length > 0 && overlaps(listing.tags, lifestyle)) return true;
  return false;
}
