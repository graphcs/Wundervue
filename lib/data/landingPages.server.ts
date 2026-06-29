import "server-only";

import { cache } from "react";
import { getSupabasePublicClient } from "@/lib/supabase/public";
import { LANDING_COLUMNS, rowToPage, type LandingPage } from "./landingPages";

export type { LandingPage };

// A published page by slug. Wrapped in React cache() so the duplicate fetch from
// generateMetadata + the page component collapses to one query per request.
// (RLS already hides unpublished rows from the anon read.)
export const getLandingPage = cache(async (slug: string): Promise<LandingPage | null> => {
  try {
    const { data } = await getSupabasePublicClient()
      .from("landing_pages")
      .select(LANDING_COLUMNS)
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    return data ? rowToPage(data as Record<string, unknown>) : null;
  } catch (err) {
    console.error("[landing] getLandingPage failed", err);
    return null;
  }
});

// Slugs of every published page — for generateStaticParams + the sitemap.
export async function getPublishedLandingSlugs(): Promise<string[]> {
  try {
    const { data } = await getSupabasePublicClient()
      .from("landing_pages")
      .select("slug")
      .eq("published", true);
    return ((data ?? []) as Array<{ slug: string }>).map((r) => r.slug);
  } catch (err) {
    console.error("[landing] getPublishedLandingSlugs failed", err);
    return [];
  }
}
