import { revalidateTag } from "next/cache";

// Cache tag for the public feed fetch (getPublishedListings' paged read). Shared
// so the loader and the write paths (ingest / expire-past maintenance) agree on
// one string.
export const FEED_CACHE_TAG = "listings";

// Invalidate the cached feed after a write so new/expired events surface right
// away instead of waiting out the loader's TTL. Wrapped in try/catch so callers
// outside a request context (e.g. scripts) are a safe no-op rather than a throw.
export function revalidateFeedCache(): void {
  try {
    // "max" = the recommended non-deprecated form: marks the tag stale with
    // stale-while-revalidate semantics (the next feed visit refetches fresh).
    revalidateTag(FEED_CACHE_TAG, "max");
  } catch {
    /* not in a request context (script/CLI) — the TTL will refresh instead */
  }
}
