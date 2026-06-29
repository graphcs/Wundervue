import "server-only";

import { cache } from "react";
import type { Filters } from "@/lib/types";
import { getSupabasePublicClient } from "@/lib/supabase/public";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";

// An SEO pillar page: editable HTML above + below a preset-filtered collection.
// Backed by the public.landing_pages table (authored in Supabase Studio).
export interface LandingPage {
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  aboveHtml: string;
  belowHtml: string;
  // A validated Filters object driving the embedded collection + "See all" link.
  filterConfig: Filters;
}

const COLUMNS =
  "slug, title, meta_title, meta_description, og_image, above_html, below_html, filter_config";

function rowToPage(r: Record<string, unknown>): LandingPage {
  return {
    slug: r.slug as string,
    title: r.title as string,
    metaTitle: r.meta_title as string | null,
    metaDescription: r.meta_description as string | null,
    ogImage: r.og_image as string | null,
    aboveHtml: (r.above_html as string) ?? "",
    belowHtml: (r.below_html as string) ?? "",
    // Validate the stored config through the same seam as URL params: unknown
    // keys / bad values are dropped and defaults filled in, so a typo'd config
    // in Studio can't produce a malformed Filters.
    filterConfig: parseSearchParams(
      (r.filter_config ?? {}) as Record<string, string | string[] | undefined>,
    ),
  };
}

// A published page by slug. Wrapped in React cache() so the duplicate fetch from
// generateMetadata + the page component collapses to one query per request.
// (RLS already hides unpublished rows from the anon read.)
export const getLandingPage = cache(async (slug: string): Promise<LandingPage | null> => {
  try {
    const { data } = await getSupabasePublicClient()
      .from("landing_pages")
      .select(COLUMNS)
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
