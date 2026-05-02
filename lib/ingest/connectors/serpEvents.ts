import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

interface SerpApiEvent {
  title?: string;
  description?: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  // SerpAPI returns both. `image` is bigger (s=10) than `thumbnail` (no size
  // suffix); both go through Google's encrypted-tbn0 CDN which still
  // downscales the original. The real full-resolution photo lives on the
  // source page — the image pipeline picks it up via og:image when the
  // probe rejects whichever Google URL we send first.
  thumbnail?: string;
  image?: string;
  venue?: { name?: string; rating?: number; reviews?: number };
  ticket_info?: Array<{ source?: string; link_type?: string; link?: string }>;
}

interface SerpApiResponse {
  events_results?: SerpApiEvent[];
  error?: string;
}

const ENDPOINT = "https://serpapi.com/search.json";

function getKey(): string {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set");
  return key;
}

export function stableSourceId(source: SourceConfig, ev: SerpApiEvent): string {
  // SerpAPI doesn't return a stable event id, and its result ordering isn't
  // guaranteed stable across calls — so the key must depend only on the
  // source plus the event's intrinsic fields (venue + date + title), never
  // on its position in the result array, or re-runs would duplicate rows.
  const venue = ev.venue?.name ?? ev.address?.[0] ?? "";
  const when = ev.date?.start_date ?? ev.date?.when ?? "";
  const key = `${source.id}|${venue}|${when}|${(ev.title ?? "").slice(0, 60)}`;
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function eventToText(ev: SerpApiEvent): string {
  const parts: string[] = [];
  if (ev.title) parts.push(`Title: ${ev.title}`);
  if (ev.venue?.name) parts.push(`Venue: ${ev.venue.name}`);
  if (ev.address?.length) parts.push(`Address: ${ev.address.join(" — ")}`);
  if (ev.date?.when) parts.push(`When: ${ev.date.when}`);
  else if (ev.date?.start_date) parts.push(`When: ${ev.date.start_date}`);
  if (ev.description) parts.push(`Description: ${ev.description}`);
  if (ev.ticket_info?.length) {
    const sources = ev.ticket_info.map((t) => t.source).filter(Boolean).join(", ");
    if (sources) parts.push(`Tickets via: ${sources}`);
  }
  return parts.join("\n");
}

export async function fetchSerpEvents(source: SourceConfig): Promise<RawItem[]> {
  if (!source.query) {
    throw new Error(`source ${source.id} missing query`);
  }
  const url = new URL(ENDPOINT);
  url.searchParams.set("engine", "google_events");
  url.searchParams.set("q", source.query);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  if (source.serpHtichips) url.searchParams.set("htichips", source.serpHtichips);
  url.searchParams.set("api_key", getKey());

  const data = await withRetry(async () => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`serpapi ${url.host} failed: status ${res.status}`);
    const json = (await res.json()) as SerpApiResponse;
    if (json.error) throw new Error(`serpapi error: ${json.error}`);
    return json;
  });

  const events = data.events_results ?? [];
  const fetchedAt = new Date().toISOString();

  return events
    .filter((ev) => ev.title)
    .map((ev): RawItem => ({
      sourceId: stableSourceId(source, ev),
      sourceUrl: ev.link,
      text: eventToText(ev),
      imageUrl: ev.image ?? ev.thumbnail,
      fetchedAt,
      // SerpAPI returns these as structured fields. Pass them through as
      // fallbacks in case the LLM fails to extract them from the prose blob —
      // observed in practice for vague titles like "BEAUZ" where the venue
      // only appears in the description, or events whose title IS the venue
      // name ("Boulder Farmers Market") and the LLM returns null.
      venueName: ev.venue?.name,
      address: ev.address?.length ? ev.address.join(", ") : undefined,
    }));
}
