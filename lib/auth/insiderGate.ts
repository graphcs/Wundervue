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

// Insider early-access gating is OFF for the pre-launch testing period, so every
// curated event/deal is free-viewable (no Insider badge, no locked detail pages,
// no feed demotion). Flip back to true to restore the lifestyle-tag gating, or
// replace with a real early_access flag when Insider early-access returns.
const INSIDER_GATING_ENABLED = false;

export function isListingInsiderOnly(
  listing: Pick<Listing, "tags">,
): boolean {
  if (!INSIDER_GATING_ENABLED) return false;
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
