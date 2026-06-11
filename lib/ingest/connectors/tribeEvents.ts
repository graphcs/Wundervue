import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { htmlToText } from "./htmlText";

// Generic connector for "The Events Calendar" (Tribe) WordPress plugin, which
// powers many venue sites (e.g. Dairy Block). The calendar page is JS-rendered,
// but the plugin exposes a clean REST API at
// /wp-json/tribe/events/v1/events with structured start/end, description,
// image, venue, and categories — so we read that instead of scraping. Configure
// with `connector: "tribeEvents"` and `url` (the site origin or events page).

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface TribeVenue {
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
}
interface TribeEvent {
  id?: number;
  url?: string;
  title?: string;
  description?: string;
  excerpt?: string;
  image?: string | { url?: string } | false;
  all_day?: boolean;
  start_date?: string; // "2026-06-10 20:30:00" in the site's local timezone
  end_date?: string;
  cost?: string;
  categories?: { name?: string }[];
  venue?: TribeVenue | string | [];
}
interface TribeResponse {
  events?: TribeEvent[];
  next_rest_url?: string;
}

// Tribe dates are "YYYY-MM-DD HH:MM:SS" already in the venue's local time — read
// the components directly so we never shift the day via a UTC round-trip.
function datePart(s: string): string {
  const [y, m, d] = (s.split(" ")[0] ?? "").split("-").map(Number);
  return y ? `${MONTHS[m - 1]} ${d}, ${y}` : "";
}
function timePart(s: string): string {
  const [h, min] = (s.split(" ")[1] ?? "").split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(min ?? 0).padStart(2, "0")} ${ampm}`;
}

// Image may be absolute or a site-relative path (e.g. /wp-content/...) — make
// it absolute against the site origin so the image pipeline can probe it.
function imageUrl(img: TribeEvent["image"], origin: string): string | undefined {
  const raw = !img ? undefined : (typeof img === "string" ? img : img.url) || undefined;
  if (!raw) return undefined;
  try {
    return new URL(raw, origin).href;
  } catch {
    return raw;
  }
}

function venueOf(v: TribeEvent["venue"]): { name?: string; address?: string } | null {
  if (!v || Array.isArray(v)) return null;
  if (typeof v === "string") {
    const name = v.trim();
    return name ? { name, address: undefined } : null;
  }
  const name = v.venue?.trim();
  const address = [v.address, v.city, v.state].map((x) => x?.trim()).filter(Boolean).join(", ");
  if (!name && !address) return null;
  return { name: name || undefined, address: address || undefined };
}

export async function fetchTribeEvents(source: SourceConfig): Promise<RawItem[]> {
  const base = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!base) throw new Error(`source ${source.id} missing url`);
  const origin = new URL(base).origin;
  // Upcoming only (the API filters by start_date); "today" in venue-metro time.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  const cap = source.maxItems ?? 50;
  const fetchedAt = new Date().toISOString();

  const MAX_PAGES = 6; // safety bound (~50 events/page)
  const PER_PROGRAM = 3; // keep up to N occurrences of a recurring series
  let endpoint: string | null = `${origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`;
  // Recurring events return one entry per occurrence (date-ascending). Keep the
  // soonest few per program — strip the trailing /YYYY-MM-DD/ from the url to
  // group occurrences — so a weekly series can't flood the cap but its next
  // dates stay filterable. Page until we hit `cap` total rows.
  const perProgram = new Map<string, number>();
  const out: RawItem[] = [];

  for (let page = 0; endpoint && out.length < cap && page < MAX_PAGES; page++) {
    const url: string = endpoint;
    const json = await withRetry<TribeResponse>(async () => {
      const res = await fetch(url, {
        headers: { "User-Agent": "WundervueBot/1.0 (+https://wundervue.com)" },
      });
      if (!res.ok) throw new Error(`tribe fetch failed: status ${res.status}`);
      return (await res.json()) as TribeResponse;
    });

    for (const e of json.events ?? []) {
      // Titles come back with HTML entities (e.g. &#038;) — decode them too.
      const title = htmlToText(e.title);
      if (!title || !e.start_date) continue;
      const key =
        (e.url ? e.url.replace(/\/\d{4}-\d{2}-\d{2}\/?$/, "").replace(/\/+$/, "") : "") ||
        title.toLowerCase();
      const kept = perProgram.get(key) ?? 0;
      if (kept >= PER_PROGRAM) continue; // already have enough of this series
      perProgram.set(key, kept + 1);

      const venue = venueOf(e.venue);
      const cats = (e.categories ?? []).map((c) => htmlToText(c.name)).filter(Boolean);
      const endT = e.end_date ? timePart(e.end_date) : "";
      const time = e.all_day ? "" : [timePart(e.start_date), endT].filter(Boolean).join(" – ");
      const description = htmlToText(e.description) || htmlToText(e.excerpt);

      const blob = [
        title,
        `Date: ${datePart(e.start_date)}`,
        time ? `Time: ${time}` : null,
        cats.length ? `Category: ${cats.join(", ")}` : null,
        e.cost ? `Cost: ${e.cost}` : null,
        description,
        venue ? `Venue: ${[venue.name, venue.address].filter(Boolean).join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      // Per-occurrence id (date-specific url) so each kept date is its own row.
      const id = e.url || String(e.id ?? `${key}-${e.start_date}`);
      out.push({
        sourceId: `${source.id}:${id}`,
        sourceUrl: e.url,
        text: blob,
        imageUrl: imageUrl(e.image, origin),
        fetchedAt,
        venueName: venue?.name,
        address: venue?.address,
      });
      if (out.length >= cap) break;
    }
    endpoint = json.next_rest_url || null;
  }

  return out.slice(0, cap);
}

