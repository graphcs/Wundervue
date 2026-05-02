// Address → lat/lng via OpenStreetMap Nominatim. Free, no API key required, but
// the public service has a strict 1 req/sec rate limit and requires a real
// User-Agent identifying the app per https://operations.osmfoundation.org/policies/nominatim/.
// We rate-limit and in-process-cache to stay polite and to avoid re-asking on
// repeated venues within a single ingest run.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
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
    const result: GeocodeResult = { lat, lng };
    cache.set(key, result);
    return result;
  } catch (err) {
    // Network failure / timeout / abort — transient, don't poison the cache.
    console.error(`[geocode] fetch failed for ${address}`, err);
    return null;
  }
}
