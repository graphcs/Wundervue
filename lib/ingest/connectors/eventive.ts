import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { localizeDenver } from "./localize";

// Eventive cinema connector. Eventive (eventive.org) powers Denver Film's
// denverfilm.org via a client-rendered widget with no public feed — but its
// "upcoming" API returns exactly the Now Playing set (the films currently
// screening, with showtimes grouped by day), which is what we want: one listing
// per film, not one per showtime.
//
// Auth: HTTP Basic with the org's *publishable* widget api_key (shipped to every
// browser, not a secret). Both the api_key and the event-bucket id live in the
// tenant bundle loaded by <org>.eventive.org. To refresh if Denver Film rotates
// the key, grab the `<script data-type="tenant" src="/<hash>.js">` from
// https://denverfilm.eventive.org/schedule and read its `api_key` / `event_bucket`.
const ENDPOINT = "https://api.eventive.org";

interface EventiveFilm {
  id: string;
  name: string;
  short_description?: string;
  description?: string;
  details?: { runtime?: string; year?: string; country?: string };
  cover_image?: string;
  poster_image?: string;
  still_image?: string;
}

interface EventiveShow {
  start_time: string;
  start_time_label?: string;
}

interface UpcomingResponse {
  films?: EventiveFilm[];
  // day ISO -> film id -> room name -> shows
  shows_by_day?: Record<string, Record<string, Record<string, EventiveShow[]>>>;
}

// "Sie FilmCenter - H2 - Maglione" -> "Sie FilmCenter" (rooms are sub-spaces of
// the one cinema; we pin every film to the venue, not the auditorium).
function roomToVenue(room: string): string {
  return room.replace(/\s*-\s*H\d.*$/i, "").trim() || "Sie FilmCenter";
}

// Eventive's default image params are below our image probe's floor (≥600x400,
// aspect ≥1.2) — e.g. covers ship at 960x380. Re-request a probe-friendly
// landscape crop from the same static image so we keep the real poster instead
// of falling back to a generated one.
function sizedImage(url: string | undefined, q: string): string | undefined {
  if (!url) return undefined;
  return `${url.split("?")[0]}?${q}`;
}

// Trailing ", 3:45 PM" on a localizeDenver() string; group 1 is the time alone.
const TIME_TAIL = /,\s*(\d{1,2}:\d{2}\s*[AP]M)$/i;

export async function fetchEventive(source: SourceConfig): Promise<RawItem[]> {
  const bucket = source.eventiveBucket;
  const apiKey = source.eventiveApiKey;
  if (!bucket || !apiKey) {
    throw new Error(`source ${source.id} needs eventiveBucket + eventiveApiKey`);
  }

  const url = `${ENDPOINT}/event_buckets/${bucket}/upcoming`;
  const auth = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
  const data = await withRetry(async () => {
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`eventive upcoming ${res.status}`);
    return (await res.json()) as UpcomingResponse;
  });

  const films = data.films ?? [];
  const showsByDay = data.shows_by_day ?? {};

  // Flatten shows_by_day into per-film showtime lists (the films[] entries carry
  // no times of their own — shows_by_day is the upcoming-only schedule).
  const showsByFilm = new Map<
    string,
    Array<{ ms: number; iso: string; room: string }>
  >();
  for (const byFilm of Object.values(showsByDay)) {
    for (const [filmId, byRoom] of Object.entries(byFilm)) {
      for (const [room, shows] of Object.entries(byRoom)) {
        for (const s of shows) {
          const ms = Date.parse(s.start_time);
          // Skip a missing/non-ISO start_time: a NaN ms would corrupt the
          // showtime sort and the cross-film soonest-first cap below.
          if (Number.isNaN(ms)) continue;
          const arr = showsByFilm.get(filmId) ?? [];
          arr.push({ ms, iso: s.start_time, room });
          showsByFilm.set(filmId, arr);
        }
      }
    }
  }

  const fetchedAt = new Date().toISOString();
  const scored: Array<{ item: RawItem; ms: number }> = [];

  for (const film of films) {
    const shows = (showsByFilm.get(film.id) ?? []).sort((a, b) => a.ms - b.ms);
    if (!shows.length) continue; // only films with upcoming showtimes
    const first = shows[0];
    const last = shows[shows.length - 1];
    const venue = roomToVenue(first.room);

    // Day-only form of a localized show ("Sun, Jun 21, 2026" without the time).
    const dayOf = (iso: string) => localizeDenver(iso).replace(TIME_TAIL, "");
    // A run spanning multiple days must read as a range so the normalizer sets
    // date_end — otherwise a still-running film (first show already past) is
    // treated as expired and drops out of the feed.
    const dateLine =
      dayOf(first.iso) === dayOf(last.iso)
        ? `Date: ${localizeDenver(first.iso)}`
        : `Date: ${dayOf(first.iso)} – ${dayOf(last.iso)}`;

    // Group showtimes by day for a readable summary in the blob.
    const byDay = new Map<string, string[]>();
    for (const s of shows) {
      const local = localizeDenver(s.iso); // "Sun, Jun 22, 2026, 3:45 PM"
      const day = local.replace(TIME_TAIL, "");
      const time = local.match(TIME_TAIL)?.[1] ?? "";
      const arr = byDay.get(day) ?? [];
      if (time) arr.push(time);
      byDay.set(day, arr);
    }
    const showtimeLines = [...byDay.entries()].map(([day, times]) => `${day}: ${times.join(", ")}`);

    const meta = [
      film.details?.year,
      film.details?.runtime && `${film.details.runtime} min`,
    ]
      .filter(Boolean)
      .join(", ");

    const text = [
      meta ? `${film.name} (${meta})` : film.name,
      dateLine,
      `Venue: ${venue}`,
      film.short_description || film.description || "",
      `Now playing at ${venue}. Showtimes:`,
      ...showtimeLines,
    ]
      .filter(Boolean)
      .join("\n");

    scored.push({
      item: {
        sourceId: `${source.id}:${film.id}`,
        sourceUrl: `https://denverfilm.eventive.org/films/${film.id}`,
        text,
        imageUrl:
          sizedImage(film.cover_image, "fit=crop&w=1000&h=560") ||
          sizedImage(film.poster_image, "fit=crop&w=1000&h=600") ||
          sizedImage(film.still_image, "fit=crop&w=1000&h=560"),
        fetchedAt,
        venueName: venue,
      },
      ms: first.ms,
    });
  }

  // Soonest first, then cap.
  scored.sort((a, b) => a.ms - b.ms);
  const out = scored.map((s) => s.item);
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
