// Venue canonicalization. Aggregator sources mention venues we've already
// seeded (or already created from another source) under slightly different
// names — "Little Blue Pigeon Books" vs "Little Blue Pigeon", "Sie Film Center"
// vs "Sie FilmCenter", "The Highlands Farmers Market" vs "Highlands Farmers
// Market". venueSlug() only matches exact slugs, so each variant spawned a
// duplicate venue row. canonicalKey() collapses those variants to one key so we
// can match an extracted name onto an existing venue before creating a new one.

// Connective stopwords dropped anywhere in the name.
const STOPWORDS = new Set(["of", "and", "at", "a", "an", "the", "in", "on"]);
// Filler dropped from the END of a name (legal/descriptive suffixes that vary
// between sources but don't change the identity of the place).
const TRAILING_FILLER = new Set([
  "books",
  "book",
  "bookshop",
  "bookstore",
  "co",
  "company",
  "llc",
  "inc",
  "presents",
]);

// A normalized identity key for a venue name. Two names with the same non-empty
// key are treated as the same venue. Returns "" for names that are too generic
// to match safely (fewer than 2 significant tokens), so single-word venues
// ("Lounge", "Studio") never collapse together.
export function canonicalKey(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ");
  const tokens = cleaned
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t));
  while (tokens.length > 1 && TRAILING_FILLER.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length < 2) return "";
  // NOTE: no plural/singular stemming. Blind trailing-"s" stripping merges
  // genuinely distinct venues that differ only by a plural token ("Highland
  // Tap" vs "Highlands Tap"), and the merge is irreversible (mis-pins events).
  // Known singular/plural variants are handled explicitly via VENUE_ALIASES.
  return tokens.join("");
}

// Curated overrides: canonicalKey(variant) -> canonical venue slug. Used when
// the automatic key can't bridge two names — chiefly plural/singular variants
// (we no longer stem) and abbreviations. Keys are `canonicalKey(variantName)`.
export const VENUE_ALIASES: Record<string, string> = {
  highlandsquare: "highlands-square", // "Highland Square" -> "Highlands Square"
  coloradofreshmarkets: "colorado-fresh-market",
  denverartssociety: "denver-art-society",
};

// Find an existing venue that represents the same place as `name`. Returns its
// slug, or null when there's no confident match (caller then creates a new
// venue). Prefers the shortest existing name as the most canonical, and refuses
// to guess when a key is ambiguous (matches 2+ distinct venues).
export function findCanonicalSlug(
  name: string,
  venues: Array<{ slug: string; name: string }>,
): string | null {
  const key = canonicalKey(name);
  if (!key) return null;
  if (VENUE_ALIASES[key]) return VENUE_ALIASES[key];
  const matches = venues.filter((v) => canonicalKey(v.name) === key);
  if (matches.length === 0) return null;
  // Ambiguous: the key collides with multiple distinct venues — don't guess
  // which one this name belongs to (avoids silently mis-pinning).
  const distinctSlugs = new Set(matches.map((m) => m.slug));
  if (distinctSlugs.size > 1) return null;
  return matches[0].slug;
}
