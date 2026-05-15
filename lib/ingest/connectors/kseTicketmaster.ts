import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Many KSE-owned venues (Paramount Theatre Denver, etc.) load their
// schedule via a Ticketmaster widget that hits alttix.ksehq.com — a
// CORS-friendly proxy that returns the standard Ticketmaster Discovery
// API event array verbatim. Calling it directly with a venue ID is
// dramatically more reliable than scraping the JS-rendered widget DOM.

const API = "https://alttix.ksehq.com/api/tm/venue";

interface TmImage {
  ratio?: number;
  url?: string;
  width?: number;
  height?: number;
}

interface TmDate {
  localDate?: string;
  localTime?: string;
  dateTime?: string;
  status?: { code?: string };
}

interface TmVenue {
  name?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  address?: { line1?: string };
}

interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: TmImage[];
  dates?: { start?: TmDate; status?: { code?: string } };
  _embedded?: { venues?: TmVenue[] };
}

// Prefer landscape images that comfortably pass our probe's aspect floor
// (1.2-2.4). Ticketmaster's RETINA_PORTRAIT_16_9 is actually 640x360
// landscape (the "PORTRAIT" name is misleading — it refers to the original
// crop). TABLET_LANDSCAPE_3_2 at 1024x683 is the safer bet when present.
function pickImage(images: TmImage[] | undefined): string | undefined {
  if (!images?.length) return undefined;
  // Prefer 16:9-ish or 3:2 with width >= 600.
  const landscape = images
    .filter((i) => i.url && i.width && i.height && i.width / i.height >= 1.2 && i.width / i.height <= 2.4)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (landscape[0]?.url) return landscape[0].url;
  return images[0]?.url;
}

function eventToText(ev: TmEvent): string {
  const parts: string[] = [];
  if (ev.name) parts.push(`Title: ${ev.name}`);
  const venue = ev._embedded?.venues?.[0];
  if (venue?.name) {
    const where = [venue.name, venue.city?.name, venue.state?.stateCode].filter(Boolean).join(", ");
    parts.push(`Venue: ${where}`);
  }
  const start = ev.dates?.start;
  if (start) {
    const when = start.dateTime ?? `${start.localDate ?? ""}${start.localTime ? ` ${start.localTime}` : ""}`.trim();
    if (when) parts.push(`When: ${when}`);
  }
  if (ev.info) parts.push(`Description: ${ev.info.slice(0, 500)}`);
  return parts.join("\n");
}

export async function fetchKseTicketmaster(source: SourceConfig): Promise<RawItem[]> {
  const venueId = source.kseTmVenueId;
  if (!venueId) {
    throw new Error(`source ${source.id} missing kseTmVenueId`);
  }
  const url = `${API}/${venueId}`;

  const json = await withRetry(async () => {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`kse tm api ${res.status} for venue ${venueId}`);
    return (await res.json()) as TmEvent[];
  });

  if (!Array.isArray(json)) {
    throw new Error(`kse tm api returned non-array for venue ${venueId}`);
  }

  const now = Date.now();
  const upcoming = json
    .filter((ev) => ev.name && ev.dates?.start)
    .filter((ev) => {
      const dt = ev.dates!.start!.dateTime ?? ev.dates!.start!.localDate;
      return dt && new Date(dt).getTime() > now;
    })
    .sort((a, b) => {
      const ad = new Date(a.dates!.start!.dateTime ?? a.dates!.start!.localDate ?? 0).getTime();
      const bd = new Date(b.dates!.start!.dateTime ?? b.dates!.start!.localDate ?? 0).getTime();
      return ad - bd;
    });

  const limit = source.maxItems;
  const sliced = limit !== undefined ? upcoming.slice(0, limit) : upcoming;
  const fetchedAt = new Date().toISOString();

  return sliced.map((ev): RawItem => {
    const venue = ev._embedded?.venues?.[0];
    return {
      sourceId: `${source.id}:${ev.id}`,
      sourceUrl: ev.url,
      text: eventToText(ev),
      imageUrl: pickImage(ev.images),
      fetchedAt,
      venueName: venue?.name,
      address: venue?.address?.line1
        ? [venue.address.line1, venue.city?.name, venue.state?.stateCode].filter(Boolean).join(", ")
        : venue?.city?.name,
    };
  });
}
