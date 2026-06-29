import type { Filters } from "@/lib/types";
import { parseSearchParams } from "@/lib/filters/parseSearchParams";

// An SEO pillar page: editable HTML above + below a preset-filtered collection.
// Backed by the public.landing_pages table (authored in Supabase Studio). Pure
// types + row mapper here so they're testable; the DB reads live in the
// server-only landingPages.server.ts.
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

export const LANDING_COLUMNS =
  "slug, title, meta_title, meta_description, og_image, above_html, below_html, filter_config";

export function rowToPage(r: Record<string, unknown>): LandingPage {
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
