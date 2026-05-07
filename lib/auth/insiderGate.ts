import type { LifestyleTag, Listing } from "@/lib/types";
import type { Plan } from "./types";

// Tags that mark a listing as Insider-only content. Kept identical to the
// LIFESTYLE_TAGS set in lib/filters/types.ts — both mirror the same product
// concept (the "lifestyle" axis) but they live in separate files because the
// filters module is concerned with URL params and the gate is concerned with
// access control. Don't merge them without a careful look at imports.
const INSIDER_TAGS: readonly LifestyleTag[] = [
  "date-night",
  "dog-friendly",
  "family",
  "outdoor",
];

export function isListingInsiderOnly(
  listing: Pick<Listing, "tags">,
): boolean {
  if (!listing.tags || listing.tags.length === 0) return false;
  return listing.tags.some((t) => INSIDER_TAGS.includes(t));
}

export function canAccessListing(
  listing: Pick<Listing, "tags">,
  plan: Plan | null | undefined,
): boolean {
  if (!isListingInsiderOnly(listing)) return true;
  return plan === "insider";
}

export function reorderForPlan<T extends Pick<Listing, "tags">>(
  listings: readonly T[],
  plan: Plan | null | undefined,
): T[] {
  if (plan === "insider") return [...listings];
  const accessible: T[] = [];
  const locked: T[] = [];
  for (const l of listings) {
    (isListingInsiderOnly(l) ? locked : accessible).push(l);
  }
  return [...accessible, ...locked];
}
