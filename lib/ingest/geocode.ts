// Address → lat/lng via OpenStreetMap Nominatim. Free, no API key required, but
// the public service has a strict 1 req/sec rate limit and requires a real
// User-Agent identifying the app per https://operations.osmfoundation.org/policies/nominatim/.
// We rate-limit and in-process-cache to stay polite and to avoid re-asking on
// repeated venues within a single ingest run.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

// Denver Metro + I-70 mountain corridor bounding box (generous: Boulder/Lyons/
// Longmont north, Parker/Lone Tree south, Aurora east; west extends past
// Golden/Morrison up the I-70 corridor to Idaho Springs/Georgetown/Silver Plume,
// which carry real day-trip venues like The Bread Bar). Any geocode result
// outside this is a mismatch — e.g. "Washington Park" resolving to Washington
// *state*, or "Lincoln St" to Nebraska — which we reject rather than pin a
// listing thousands of miles away. The west edge stays east of the Continental
// Divide, so out-of-state rejects still hold.
const DENVER_BBOX = { minLat: 39.3, maxLat: 40.4, minLng: -105.85, maxLng: -104.4 };

export function inDenverMetro(lat: number, lng: number): boolean {
  return (
    lat >= DENVER_BBOX.minLat &&
    lat <= DENVER_BBOX.maxLat &&
    lng >= DENVER_BBOX.minLng &&
    lng <= DENVER_BBOX.maxLng
  );
}
// OSM policy requires a real contact in the User-Agent. We default to the
// production identity but allow staging/dev to override via env so changes
// don't require a code edit.
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "wundervue/0.1 (https://wundervue.com; admin@wundervue.com)";
const RATE_LIMIT_MS = 1100;

export interface GeocodeResult {
  lat: number;
  lng: number;
}

const cache = new Map<string, GeocodeResult | null>();
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

// Serialise calls so concurrent normalize batches still respect 1 req/sec.
async function paceForRateLimit(): Promise<void> {
  const myTurn = queue.then(async () => {
    const wait = lastCallAt + RATE_LIMIT_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  queue = myTurn.catch(() => undefined);
  await myTurn;
}

// Nominatim's parser handles raw street addresses but chokes on US-style
// "Unit 190", "Ste 200", "Apt 4B", "#3" — drop those and the trailing
// ", USA" so a real-world address like "900 W 1st Ave Unit 190, Denver, CO,
// USA" resolves the same as "900 W 1st Ave, Denver, CO".
export function sanitizeForGeocoder(input: string): string {
  return input
    .replace(/\b(unit|ste|suite|apt|apartment|#)\s*[\w-]+/gi, "")
    .replace(/,\s*usa\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const cleaned = sanitizeForGeocoder(address);
  const key = cleaned.toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  await paceForRateLimit();
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", cleaned);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Transient (5xx, 429, etc.): don't poison the cache — a later call in
      // this run might succeed. Only cache definitive "address not found".
      console.error(`[geocode] non-2xx for ${address}: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(data) || data.length === 0) {
      cache.set(key, null);
      return null;
    }
    const lat = parseFloat(data[0].lat ?? "");
    const lng = parseFloat(data[0].lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      cache.set(key, null);
      return null;
    }
    // Reject results outside Denver Metro — a wrong-region pin (Washington
    // state, Nebraska, etc.) is worse than no pin. Cache the rejection so we
    // don't re-query the same bad address within a run.
    if (!inDenverMetro(lat, lng)) {
      console.error(`[geocode] out-of-region result for ${address}: ${lat},${lng}`);
      cache.set(key, null);
      return null;
    }
    const result: GeocodeResult = { lat, lng };
    cache.set(key, result);
    return result;
  } catch (err) {
    // Network failure / timeout / abort — transient, don't poison the cache.
    console.error(`[geocode] fetch failed for ${address}`, err);
    return null;
  }
}

export interface ReverseGeocodeResult {
  /** OSM "neighbourhood"/"suburb" — best candidate for our neighborhood match. */
  neighbourhood?: string;
  suburb?: string;
  /** city / town / village. */
  city?: string;
}

const reverseCache = new Map<string, ReverseGeocodeResult | null>();

// Coordinates → place names via Nominatim reverse geocoding. Used as a fallback
// when the LLM can't confidently name a neighborhood but we have a pinned
// location. Returns the suburb/neighbourhood/city strings; the caller resolves
// them against the taxonomy (lib/data/locations.ts).
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!inDenverMetro(lat, lng)) return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;

  await paceForRateLimit();
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "16"); // neighbourhood-level detail

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[geocode] reverse non-2xx for ${key}: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      address?: Record<string, string | undefined>;
    };
    const a = data.address ?? {};
    const result: ReverseGeocodeResult = {
      neighbourhood: a.neighbourhood,
      suburb: a.suburb,
      city: a.city ?? a.town ?? a.village,
    };
    reverseCache.set(key, result);
    return result;
  } catch (err) {
    console.error(`[geocode] reverse fetch failed for ${key}`, err);
    return null;
  }
}
