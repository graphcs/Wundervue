import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { registerDynamicCities, type DynamicCity } from "@/lib/data/locations";

// Cached read of the auto-discovered metro cities. A cookie-free anon client is
// used (no request state) so it's safe inside unstable_cache. Tagged + TTL'd so
// a newly auto-added city appears site-wide within ~5 minutes without a redeploy.
const loadDynamicCities = unstable_cache(
  async (): Promise<DynamicCity[]> => {
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("metro_cities")
      .select("slug, label, region_slug");
    if (error) {
      console.error("[metro_cities] load failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      slug: r.slug as string,
      label: r.label as string,
      regionSlug: r.region_slug as string,
    }));
  },
  ["metro-cities"],
  { tags: ["metro-cities"], revalidate: 300 },
);

/**
 * Hydrate the taxonomy's dynamic-city registry for this server render and return
 * the list (to bootstrap the client). Call at the top of any server route/layout
 * that reads the taxonomy, BEFORE any isPlaceSlug/locationBySlug/metadata call.
 */
export async function ensureDynamicCities(): Promise<DynamicCity[]> {
  const cities = await loadDynamicCities();
  registerDynamicCities(cities);
  return cities;
}
