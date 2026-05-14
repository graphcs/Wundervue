import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// VenuePilot is a ticketing platform many independent music venues use
// (Levitt Pavilion Denver, smaller indie venues). Their site widget loads
// events at runtime from a GraphQL endpoint — far more reliable than
// scraping the host site's HTML, which is usually a JS-rendered shell.
//
// The endpoint and query shape were derived from the widget bundle at
// widget.staging.venuepilot.com/2.0.0-*/vp-widget.umd.js (see
// publicEvents/paginatedEvents query bodies). It is unauthenticated and
// CORS-enabled for widget hosts; we mirror the widget's Origin/Referer
// headers to keep behavior consistent.

const ENDPOINT = "https://www.venuepilot.co/graphql";

interface VpVenue {
  name?: string;
}

interface VpImageVersions {
  cover?: { src?: string };
  thumb?: { src?: string };
}

interface VpAnnounceImage {
  highlighted?: boolean;
  versions?: VpImageVersions;
}

interface VpEvent {
  id: string;
  name?: string;
  date?: string;
  doorTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  venue?: VpVenue | null;
  announceImages?: VpAnnounceImage[];
}

interface VpResponse {
  data?: { publicEvents?: VpEvent[] };
  errors?: Array<{ message?: string }>;
}

// Asks only for the fields normalize.ts actually consumes. The wire query
// is plain text so we don't pull in apollo/graphql-tag — just POST it.
const PUBLIC_EVENTS_QUERY = `
  query ($accountIds: [Int!]!, $startDate: String!, $endDate: String, $limit: Int) {
    publicEvents(accountIds: $accountIds, startDate: $startDate, endDate: $endDate, limit: $limit) {
      id
      name
      date
      doorTime
      startTime
      endTime
      description
      websiteUrl
      venue { name }
      announceImages {
        highlighted
        versions { cover { src } thumb { src } }
      }
    }
  }
`;

function pickImage(images: VpAnnounceImage[] | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  // Highlighted gets priority — when set, it's the venue's hero asset.
  const highlighted = images.find((i) => i.highlighted);
  const winner = highlighted ?? images[0];
  return winner.versions?.cover?.src ?? winner.versions?.thumb?.src;
}

function eventToText(ev: VpEvent): string {
  const parts: string[] = [];
  if (ev.name) parts.push(`Title: ${ev.name}`);
  if (ev.venue?.name) parts.push(`Venue: ${ev.venue.name}`);
  if (ev.date) {
    // VenuePilot returns date as YYYY-MM-DD and a separate startTime.
    // Stitch them so the LLM normalizer sees one canonical "when" line.
    const when = ev.startTime ? `${ev.date} at ${ev.startTime}` : ev.date;
    parts.push(`When: ${when}`);
  }
  if (ev.doorTime) parts.push(`Doors: ${ev.doorTime}`);
  if (ev.description) parts.push(`Description: ${ev.description}`);
  return parts.join("\n");
}

export async function fetchVenuePilot(source: SourceConfig): Promise<RawItem[]> {
  const accountIds = source.venuePilotAccountIds ?? [];
  if (accountIds.length === 0) {
    throw new Error(`source ${source.id} missing venuePilotAccountIds`);
  }
  // Pull events from today out ~6 months. Far-future shows show up in
  // subsequent runs as their dates approach; the maxItems cap further
  // bounds the pipeline budget for hot venues that book heavily.
  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDateObj = new Date(today);
  endDateObj.setMonth(endDateObj.getMonth() + 6);
  const endDate = endDateObj.toISOString().slice(0, 10);

  const body = JSON.stringify({
    query: PUBLIC_EVENTS_QUERY,
    variables: {
      accountIds,
      startDate,
      endDate,
      // Server-side limit: cap a little above our local maxItems so we
      // still get a full sweep even if some events get filtered out.
      limit: (source.maxItems ?? 50) * 2,
    },
  });

  const json = await withRetry(async () => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body,
    });
    if (!res.ok) throw new Error(`venuepilot graphql ${res.status}`);
    const data = (await res.json()) as VpResponse;
    if (data.errors?.length) {
      throw new Error(`venuepilot graphql errors: ${data.errors.map((e) => e.message).join("; ")}`);
    }
    return data;
  });

  const events = json.data?.publicEvents ?? [];
  const fetchedAt = new Date().toISOString();
  const limit = source.maxItems;

  // GraphQL returns events ordered by date ascending — slicing keeps the
  // soonest-N, which is what we want for a recurring cron.
  const sliced = limit !== undefined ? events.slice(0, limit) : events;

  return sliced
    .filter((ev) => ev.name)
    .map((ev): RawItem => ({
      // VenuePilot ids are globally unique per event so the source prefix
      // alone is enough to keep us collision-free across venues.
      sourceId: `${source.id}:${ev.id}`,
      sourceUrl: ev.websiteUrl ?? undefined,
      text: eventToText(ev),
      imageUrl: pickImage(ev.announceImages),
      fetchedAt,
      venueName: ev.venue?.name ?? undefined,
    }));
}
