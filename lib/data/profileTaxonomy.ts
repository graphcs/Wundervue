import type { LifestyleTag } from "@/lib/types";
import { categorySlug } from "@/lib/data/categories";

// Bridges the two vocabularies that never matched before: a user's onboarding
// prefs (interest ids in ONBOARDING_INTERESTS, lifestyle ids in
// lifestyleOptions, neighborhood labels) vs. a listing's category label/slug and
// LifestyleTags. Shared by the For You ranking (recommendations.ts) and the
// notification audience matcher (lib/notify/match.ts) so they can't drift.

export interface ProfilePrefs {
  interests?: string[] | null; // onboarding interest ids
  neighborhoods?: string[] | null; // neighborhood labels
  lifestyle?: string[] | null; // onboarding lifestyle ids
}

export interface ListingFields {
  category?: string | null; // listing category label (e.g. "Food & Drink")
  neighborhood?: string | null; // listing neighborhood label
  tags?: string[] | null;
  isFree?: boolean | null;
}

// Onboarding ids → listing vocabulary. Entries with no listing equivalent
// (interest "nightlife", lifestyle "new") simply don't contribute.
const INTEREST_CATEGORY: Record<string, string> = {
  concerts: "music",
  food: "food-drink",
  outdoor: "outdoor",
  arts: "arts-culture",
  sports: "sports",
  comedy: "comedy",
  markets: "markets",
  wellness: "wellness",
};
const INTEREST_TAG: Record<string, LifestyleTag> = { family: "family", dogs: "dog-friendly" };
const LIFESTYLE_TAG: Record<string, LifestyleTag> = { kids: "family", dog: "dog-friendly", couple: "date-night" };
const LIFESTYLE_CATEGORY: Record<string, string> = { foodie: "food-drink" };

export interface Wanted {
  categories: Set<string>; // category slugs
  tags: Set<string>;
  neighborhoods: Set<string>; // labels
  free: boolean;
  empty: boolean; // user has set no prefs at all
}

export function buildWanted(profile: ProfilePrefs): Wanted {
  const interests = profile.interests ?? [];
  const neighborhoods = profile.neighborhoods ?? [];
  const lifestyle = profile.lifestyle ?? [];
  const categories = new Set<string>();
  const tags = new Set<string>();
  for (const i of interests) {
    if (INTEREST_CATEGORY[i]) categories.add(INTEREST_CATEGORY[i]);
    if (INTEREST_TAG[i]) tags.add(INTEREST_TAG[i]);
  }
  for (const l of lifestyle) {
    if (LIFESTYLE_TAG[l]) tags.add(LIFESTYLE_TAG[l]);
    if (LIFESTYLE_CATEGORY[l]) categories.add(LIFESTYLE_CATEGORY[l]);
  }
  return {
    categories,
    tags,
    neighborhoods: new Set(neighborhoods),
    free: interests.includes("free"),
    empty: interests.length === 0 && neighborhoods.length === 0 && lifestyle.length === 0,
  };
}

// Relevance score for a listing against pre-built wants. Higher = more relevant.
export function scoreFields(f: ListingFields, w: Wanted): number {
  let score = 0;
  const slug = f.category ? categorySlug(f.category) : undefined;
  if (slug && w.categories.has(slug)) score += 3;
  if (f.neighborhood && w.neighborhoods.has(f.neighborhood)) score += 3;
  if (f.tags) for (const t of f.tags) if (w.tags.has(t)) score += 2;
  if (w.free && f.isFree) score += 1;
  return score;
}

// Boolean relevance for notification audiences: a user with no prefs matches
// everything (so they still get value); otherwise they match on any overlap.
export function matchesProfile(f: ListingFields, profile: ProfilePrefs): boolean {
  const w = buildWanted(profile);
  return w.empty || scoreFields(f, w) > 0;
}
