import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import {
  getRegisteredDynamicCities,
  registerDynamicCities,
  type DynamicCity,
} from "@/lib/data/locations";

// Cached read of the auto-discovered metro cities. A cookie-free anon client is
// used (no request state) so it's safe inside unstable_cache. Tagged + TTL'd so
// a newly auto-added city appears site-wide within ~5 minutes without a redeploy.
// THROWS on a read error (rather than returning []) so the failure isn't cached
// and doesn't get turned into an empty registry that 404s valid city pages.
const loadDynamicCities = unstable_cache(
  async (): Promise<DynamicCity[]> => {
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("metro_cities")
      .select("slug, label, region_slug");
    if (error) throw new Error(`metro_cities load failed: ${error.message}`);
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
  try {
    const cities = await loadDynamicCities();
    registerDynamicCities(cities);
    return cities;
  } catch (err) {
    // Transient read failure: keep the last-known registry rather than clearing
    // it (which would 404 valid auto-added city pages). Serve slightly-stale data.
    console.error(
      "[metro_cities] load failed; keeping last-known cities:",
      (err as Error).message,
    );
    return [...getRegisteredDynamicCities()];
  }
}
