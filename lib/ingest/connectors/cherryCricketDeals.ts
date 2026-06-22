import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

// The Cherry Cricket — a recurring Happy Hour deal per location. The location
// pages expose the time window as text ("Happy Hour 2-5PM & 10PM-12AM EVERY
// DAY"); the priced items ($5 wells, $6 chili cheese fries, $7 wings) live in a
// graphic, not text, so those are a maintained constant. We scrape the window
// (and use it as a presence check — no "Happy Hour" on the page → no deal) and
// emit one recurring deal per location, which buildListingInsert keeps visible
// via the perpetual-deal window.
const LOCATIONS = [
  { name: "Cherry Creek", url: "https://cherrycricket.com/location-cherry", address: "2641 E 2nd Ave, Denver, CO 80206" },
  { name: "Downtown", url: "https://cherrycricket.com/location-downtown", address: "2220 Blake Street, Denver, CO 80205" },
  { name: "Littleton", url: "https://cherrycricket.com/location-littleton", address: "819 W Littleton Blvd, Littleton, CO 80120" },
  { name: "Broomfield", url: "https://cherrycricket.com/location-broomfield", address: "1280 E 1st Ave, Broomfield, CO 80020" },
];

// Image-locked specifics from the Happy Hour graphic — update if the menu changes.
const ITEMS =
  "$5 well liquor & select domestic drafts, chips & salsa; $6 house wines, chili cheese fries, pretzel bites & queso; $7 house bubbles & 1/2-pound chicken wings. Ask your server for specifics.";
// Capture the time window after "Happy Hour", ending at a daily phrase. Accept
// the common wordings ("every day", "everyday", "daily", "7 days a week") and
// don't require the window to start with a digit ("Daily 2-5PM" is valid).
const HH_RE = /Happy Hour\s+([^<]{0,80}?(?:every\s?day|everyday|daily|7\s*days(?:\s*a\s*week)?))/i;

function pageText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchCherryCricketDeals(source: SourceConfig): Promise<RawItem[]> {
  const fetchedAt = new Date().toISOString();
  const out: RawItem[] = [];

  for (const loc of LOCATIONS) {
    const window = await withRetry(async () => {
      const res = await fetch(loc.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`cherry-cricket ${loc.name} ${res.status}`);
      const text = pageText(await res.text());
      // Presence check: no "Happy Hour" anywhere on the page → the deal is gone.
      if (!/happy hour/i.test(text)) return null;
      // Present: use the parsed window, but fall back to a generic daily label
      // rather than DROPPING a live deal when the wording doesn't parse.
      return text.match(HH_RE)?.[1]?.trim() || "offered daily — see venue for current times";
    });
    if (!window) continue;

    const venueName = `The Cherry Cricket – ${loc.name}`;
    const text = [
      `Happy Hour at ${venueName}`,
      `Ongoing daily deal — Happy Hour ${window}.`,
      ITEMS,
      `Venue: ${venueName}`,
      `Address: ${loc.address}`,
    ].join("\n");

    out.push({
      sourceId: `${source.id}:${loc.name.toLowerCase().replace(/\s+/g, "-")}`,
      sourceUrl: loc.url,
      text,
      fetchedAt,
      venueName,
      address: loc.address,
    });
  }
  return out;
}
