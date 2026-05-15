import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// Wix Events powers the event widget on tens of thousands of small-business
// Wix sites (independent bookstores, breweries, yoga studios, etc.). The
// widget is JS-rendered, but its backing API is reachable directly at
// www.wixapis.com/events/v3/events/query with the tenant's `instance`
// JWT — which the public site embeds inline. We scrape that token from
// the page, then POST the query. The token rotates on the site's normal
// cache cycle, so re-extracting on every run keeps us auth-fresh without
// any manual config maintenance.

const API = "https://www.wixapis.com/events/v3/events/query";

interface WixLocation {
  name?: string;
  address?: {
    formattedAddress?: string;
    city?: string;
    subdivision?: string;
    country?: string;
  };
}

interface WixMainImage {
  url?: string;
  width?: number;
  height?: number;
}

interface WixEvent {
  id: string;
  title?: string;
  shortDescription?: string;
  detailedDescription?: string;
  mainImage?: WixMainImage;
  location?: WixLocation;
  status?: string;
  dateAndTimeSettings?: {
    startDate?: string;
    endDate?: string | null;
    formatted?: { dateAndTime?: string };
  };
  eventPageUrl?: { base?: string; path?: string };
}

interface WixEventsResponse {
  events?: WixEvent[];
  pagingMetadata?: unknown;
}

function browserHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

async function extractInstanceJwt(siteUrl: string): Promise<string> {
  const res = await fetch(siteUrl, { headers: browserHeaders() });
  if (!res.ok) {
    throw new Error(`wixEvents site fetch ${res.status}: ${siteUrl}`);
  }
  const html = await res.text();
  // Each Wix site embeds the events-app instance JWT inline. Multiple
  // app instances may be on the page; the JWT we want has the events
  // app-def-id 140603ad-af8d-84a5-2c80-a0f60cb47351 baked into its
  // base64-encoded second segment. Match that to avoid grabbing a
  // different app's token by accident.
  const matches = html.match(/"instance":"([A-Za-z0-9_.-]+)"/g) ?? [];
  for (const m of matches) {
    const token = m.match(/"instance":"([A-Za-z0-9_.-]+)"/)?.[1];
    if (!token) continue;
    const parts = token.split(".");
    if (parts.length < 2) continue;
    try {
      // base64url-decode the payload and confirm it's the events app
      const padded = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
      const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
      if (/140603ad-af8d-84a5-2c80-a0f60cb47351/.test(json)) {
        return token;
      }
    } catch {
      // fall through; we'll try the next match
    }
  }
  throw new Error(`wixEvents instance token not found in ${siteUrl}`);
}

function eventToText(ev: WixEvent): string {
  const parts: string[] = [];
  if (ev.title) parts.push(`Title: ${ev.title}`);
  if (ev.location?.name) parts.push(`Venue: ${ev.location.name}`);
  const addr = ev.location?.address?.formattedAddress;
  if (addr) parts.push(`Address: ${addr}`);
  const when = ev.dateAndTimeSettings?.formatted?.dateAndTime ?? ev.dateAndTimeSettings?.startDate;
  if (when) parts.push(`When: ${when}`);
  const desc = ev.shortDescription ?? ev.detailedDescription;
  if (desc) parts.push(`Description: ${desc.slice(0, 600)}`);
  return parts.join("\n");
}

export async function fetchWixEvents(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url) {
    throw new Error(`source ${source.id} missing url`);
  }
  const instance = await withRetry(() => extractInstanceJwt(source.url!));

  const json = await withRetry(async () => {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: instance,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": browserHeaders()["User-Agent"],
      },
      body: JSON.stringify({ query: { paging: { limit: 100 } } }),
    });
    if (!res.ok) throw new Error(`wix events query ${res.status}`);
    return (await res.json()) as WixEventsResponse;
  });

  const now = Date.now();
  const upcoming = (json.events ?? [])
    .filter((ev) => ev.status === "UPCOMING")
    .filter((ev) => {
      const start = ev.dateAndTimeSettings?.startDate;
      return start && new Date(start).getTime() > now;
    })
    .sort((a, b) => {
      const ta = new Date(a.dateAndTimeSettings!.startDate!).getTime();
      const tb = new Date(b.dateAndTimeSettings!.startDate!).getTime();
      return ta - tb;
    });

  const limit = source.maxItems;
  const sliced = limit !== undefined ? upcoming.slice(0, limit) : upcoming;
  const fetchedAt = new Date().toISOString();

  return sliced
    .filter((ev) => ev.title)
    .map((ev): RawItem => {
      const url = ev.eventPageUrl ? `${ev.eventPageUrl.base ?? ""}${ev.eventPageUrl.path ?? ""}` : undefined;
      return {
        sourceId: `${source.id}:${ev.id}`,
        sourceUrl: url,
        text: eventToText(ev),
        imageUrl: ev.mainImage?.url,
        fetchedAt,
        venueName: ev.location?.name,
        address: ev.location?.address?.formattedAddress,
      };
    });
}
