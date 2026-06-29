import type { MetadataRoute } from "next";
import { ALL_PLACES } from "@/lib/data/locations";
import { CATEGORIES } from "@/lib/data/categories";
import { getPublishedLandingSlugs } from "@/lib/data/landingPages.server";
import { SITE_URL } from "@/lib/links";

// Explicit route list — keep in sync when adding an SEO-worthy route family.
// Detail pages (/events, /deals, /venues) and /explore/[segment]/[category]
// combos are intentionally omitted: they render on demand.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const landingSlugs = await getPublishedLandingSlugs();
  const entries: Array<{ path: string; priority: number }> = [
    { path: "", priority: 1 },
    { path: "/venues", priority: 0.6 },
    { path: "/stories", priority: 0.4 },
    // SEO pillar pages — highest priority.
    ...landingSlugs.map((s) => ({ path: `/things-to-do/${s}`, priority: 0.9 })),
    // Pre-rendered neighborhood + category explore pages.
    ...ALL_PLACES.map((p) => ({ path: `/explore/${p.slug}`, priority: 0.7 })),
    ...CATEGORIES.map((c) => ({ path: `/explore/${c.slug}`, priority: 0.7 })),
  ];
  return entries.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "daily",
    priority,
  }));
}
