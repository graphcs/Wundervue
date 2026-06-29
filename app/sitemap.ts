import type { MetadataRoute } from "next";
import { ALL_PLACES, getRegisteredDynamicCities } from "@/lib/data/locations";
import { CATEGORIES } from "@/lib/data/categories";
import { ensureDynamicCities } from "@/lib/data/dynamicCities.server";
import { getPublishedLandingPages } from "@/lib/data/landingPages.server";
import { SITE_URL } from "@/lib/links";

// Explicit route list — keep in sync when adding an SEO-worthy route family.
// Detail pages (/events, /deals, /venues) and /explore/[segment]/[category]
// combos are intentionally omitted: they render on demand.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Register auto-discovered cities first so their /explore/<city> pages are
  // included (they aren't in the static ALL_PLACES list).
  const [, landingPages] = await Promise.all([ensureDynamicCities(), getPublishedLandingPages()]);
  const placeSlugs = [
    ...new Set([...ALL_PLACES, ...getRegisteredDynamicCities()].map((p) => p.slug)),
  ];

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/venues`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/stories`, changeFrequency: "monthly", priority: 0.4 },
    // SEO pillar pages — highest priority; lastModified drives re-crawl.
    ...landingPages.map((p) => ({
      url: `${SITE_URL}/things-to-do/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    // Neighborhood/city + category explore pages.
    ...placeSlugs.map((slug) => ({
      url: `${SITE_URL}/explore/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}/explore/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
