import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// VenuePilot powers ticketing + event listings for many independent venues
// (e.g. Levitt Pavilion Denver). Their sites embed a JS widget that loads
// events client-side from a public GraphQL API, so the page HTML has nothing to
// scrape — we hit the API directly instead. Configure a source with
// `connector: "venuePilot"` and `venuePilotAccountIds: [<id>]` (the account id
// is in the embed config on the venue's site, e.g. `accountIds: [1105]`).
const ENDPOINT = "https://www.venuepilot.co/graphql";

// `arguments` is an EventsApiArguments input; accountIds + startDate + limit are
// the fields we need. startDate filters to upcoming (the default order returns
// the full history oldest-first). images is a JSON-encoded string array.
const QUERY = `query($args: EventsApiArguments!) {
  paginatedEvents(arguments: $args) {
    collection {
      id name date doorTime startTime status minimumAge
      description footerContent
      announceArtists { name }
      images
      ticketsUrl
      venue { name city state }
    }
  }
}`;

interface VenuePilotEvent {
  id: number;
  name: string;
  date: string;
  doorTime?: string;
  startTime?: string;
  status?: string;
  minimumAge?: string | number;
  description?: string;
  footerContent?: string;
  announceArtists?: Array<{ name: string }>;
  images?: string;
  ticketsUrl?: string;
  venue?: { name?: string; city?: string; state?: string };
}

function stripHtml(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// images comes back as a JSON-encoded array of URLs (occasionally a bare URL).
function firstImage(images: string | undefined): string | undefined {
  if (!images) return undefined;
  try {
    const arr = JSON.parse(images);
    if (Array.isArray(arr) && arr.length && typeof arr[0] === "string") return arr[0];
  } catch {
    /* not JSON — fall through */
  }
  return /^https?:\/\//.test(images) ? images : undefined;
}

export async function fetchVenuePilot(source: SourceConfig): Promise<RawItem[]> {
  const accountIds = source.venuePilotAccountIds;
  if (!accountIds || accountIds.length === 0) {
    throw new Error(`source ${source.id} missing venuePilotAccountIds`);
  }
  // Upcoming only — start from today (venue-local dates are plain YYYY-MM-DD).
  const startDate = new Date().toISOString().slice(0, 10);
  const limit = source.maxItems ?? 60;

  const collection = await withRetry(async () => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: { args: { accountIds, startDate, limit } },
      }),
    });
    if (!res.ok) throw new Error(`venuepilot fetch failed: status ${res.status}`);
    const json = (await res.json()) as {
      data?: { paginatedEvents?: { collection?: VenuePilotEvent[] } };
      errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) {
      throw new Error(`venuepilot graphql: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    return json.data?.paginatedEvents?.collection ?? [];
  });

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const ev of collection) {
    const sourceId = String(ev.id);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const artists = (ev.announceArtists ?? []).map((a) => a.name).filter(Boolean).join(", ");
    const venueLine = ev.venue
      ? [ev.venue.name, ev.venue.city, ev.venue.state].filter(Boolean).join(", ")
      : "";
    // Compose a prose blob the normalizer can extract from. The structured
    // bits (date, admission, artists) lead so the LLM keys on them reliably.
    const text = [
      ev.name?.trim(),
      ev.date && `Date: ${ev.date}${ev.startTime ? ` at ${ev.startTime.slice(0, 5)}` : ""}`,
      ev.status && `Admission: ${ev.status}`,
      artists && `Artists: ${artists}`,
      venueLine && `Venue: ${venueLine}`,
      ev.minimumAge != null && ev.minimumAge !== "" && `Ages: ${ev.minimumAge}`,
      stripHtml(ev.description),
      stripHtml(ev.footerContent),
    ]
      .filter(Boolean)
      .join("\n");

    out.push({
      sourceId,
      sourceUrl: ev.ticketsUrl || undefined,
      ticketUrl: ev.ticketsUrl || undefined,
      text,
      imageUrl: firstImage(ev.images),
      fetchedAt,
      venueName: ev.venue?.name ?? undefined,
    });
  }
  return out;
}
