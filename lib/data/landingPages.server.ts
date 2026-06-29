import "server-only";

import { cache } from "react";
import { getSupabasePublicClient } from "@/lib/supabase/public";
import { LANDING_COLUMNS, rowToPage, type LandingPage } from "./landingPages";

export type { LandingPage };

export interface PublishedLandingRef {
  slug: string;
  updatedAt: string;
}

// A published page by slug. Wrapped in React cache() so the duplicate fetch from
// generateMetadata + the page component collapses to one query per request.
// (RLS already hides unpublished rows from the anon read.) Throws on a real read
// error so a transient failure surfaces as a retryable 5xx — NOT a hard 404 that
// would de-index a live page; null means genuinely-missing.
export const getLandingPage = cache(async (slug: string): Promise<LandingPage | null> => {
  const { data, error } = await getSupabasePublicClient()
    .from("landing_pages")
    .select(LANDING_COLUMNS)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(`landing_pages read failed: ${error.message}`);
  return data ? rowToPage(data as Record<string, unknown>) : null;
});

// Published pages (slug + updated_at) for the sitemap. Throws on error rather
// than returning [] so a flaky build fails loudly instead of silently dropping
// every pillar page from search indexing.
export async function getPublishedLandingPages(): Promise<PublishedLandingRef[]> {
  const { data, error } = await getSupabasePublicClient()
    .from("landing_pages")
    .select("slug, updated_at")
    .eq("published", true);
  if (error) throw new Error(`landing_pages list failed: ${error.message}`);
  return ((data ?? []) as Array<{ slug: string; updated_at: string }>).map((r) => ({
    slug: r.slug,
    updatedAt: r.updated_at,
  }));
}
