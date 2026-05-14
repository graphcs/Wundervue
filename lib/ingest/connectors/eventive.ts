import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Eventive is the ticketing platform behind many cinema festivals and
// arthouse cinema programs (Denver Film, Sundance, Tribeca, etc.). Each
// tenant's site is a JS-only SPA loading from api.eventive.org with a
// public api_key embedded in the tenant's bundle. We mirror that auth
// pattern to read the events directly without scraping the rendered DOM.
//
// Endpoint discovered via tenant bundle inspection:
//   GET https://api.eventive.org/event_buckets/{bucketId}/events
//   headers: X-Api-Key: <public tenant key>, Origin: <tenant>.eventive.org

const API_ROOT = "https://api.eventive.org";

interface EventiveVenue {
  name?: string;
  address?: string;
}

interface EventiveFilm {
  id?: string;
  name?: string;
  short_description?: string;
  description?: string;
  cover_image?: string;
  poster_image?: string;
  still_image?: string;
}

interface EventiveEvent {
  id: string;
  name?: string;
  start_time?: string;
  end_time?: string | null;
  description?: string;
  short_description?: string;
  venue?: EventiveVenue;
  films?: EventiveFilm[];
}

interface EventiveResponse {
  events?: EventiveEvent[];
  error?: { code?: string; message?: string };
}

function stripHtml(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Prefer the film's still_image (typically 16:9 native), fall back to the
// cover_image with size params that produce a 3:2 landscape — both pass
// our image probe's aspect floor (1.2–2.4) so we sidestep AI gen for
// most films.
function pickImage(film: EventiveFilm | undefined): string | undefined {
  if (!film) return undefined;
  if (film.still_image) return film.still_image;
  if (film.cover_image) {
    // Eventive's CDN supports ?w=&h=&fit=crop transforms; rewrite any
    // existing width/height query to land in landscape territory.
    try {
      const u = new URL(film.cover_image);
      u.searchParams.set("w", "1200");
      u.searchParams.set("h", "800");
      u.searchParams.set("fit", "crop");
      return u.toString();
    } catch {
      return film.cover_image;
    }
  }
  return film.poster_image;
}

function eventToText(ev: EventiveEvent, film: EventiveFilm | undefined): string {
  const parts: string[] = [];
  if (ev.name) parts.push(`Title: ${ev.name}`);
  if (ev.venue?.name) parts.push(`Venue: ${ev.venue.name}`);
  if (ev.venue?.address) parts.push(`Address: ${ev.venue.address}`);
  if (ev.start_time) parts.push(`When: ${ev.start_time}`);
  // Films carry the description; events themselves rarely do.
  const desc = stripHtml(film?.short_description) || stripHtml(film?.description) || stripHtml(ev.short_description) || stripHtml(ev.description);
  if (desc) parts.push(`Description: ${desc.slice(0, 600)}`);
  return parts.join("\n");
}

export async function fetchEventive(source: SourceConfig): Promise<RawItem[]> {
  const apiKey = source.eventiveApiKey;
  const bucketId = source.eventiveEventBucketId;
  const tenant = source.eventiveTenant;
  if (!apiKey || !bucketId || !tenant) {
    throw new Error(
      `source ${source.id} missing eventiveTenant / eventiveApiKey / eventiveEventBucketId`,
    );
  }
  const url = `${API_ROOT}/event_buckets/${bucketId}/events`;

  const json = await withRetry(async () => {
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(`eventive ${res.status} for bucket ${bucketId}`);
    }
    const data = (await res.json()) as EventiveResponse;
    if (data.error) {
      throw new Error(`eventive api error: ${data.error.message ?? data.error.code}`);
    }
    return data;
  });

  const now = Date.now();
  // Many of Eventive's buckets carry their full historical schedule
  // (Denver Film: 13k events all-time, 138 upcoming). Filter to upcoming
  // first so the cap selects the soonest-N, not arbitrary historical
  // ones.
  const upcoming = (json.events ?? [])
    .filter((e) => e.start_time && new Date(e.start_time).getTime() > now)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

  const limit = source.maxItems;
  const sliced = limit !== undefined ? upcoming.slice(0, limit) : upcoming;
  const fetchedAt = new Date().toISOString();

  return sliced
    .filter((ev) => ev.name)
    .map((ev): RawItem => {
      const film = ev.films?.[0];
      return {
        sourceId: `${source.id}:${ev.id}`,
        sourceUrl: `https://${tenant}.eventive.org/schedule/${ev.id}`,
        text: eventToText(ev, film),
        imageUrl: pickImage(film),
        fetchedAt,
        venueName: ev.venue?.name,
        address: ev.venue?.address,
      };
    });
}
