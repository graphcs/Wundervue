import { createHash } from "node:crypto";
import type { RawItem, SourceConfig } from "../types";
import { fetchText } from "./feedFetch";
import { localizeDenver } from "./localize";

// Generic iCalendar (.ics) feed connector — most useful for the very common
// "embedded public Google Calendar" pattern (calendar.google.com/calendar/ical/
// <id>/public/basic.ics), e.g. Lady Justice Brewing. Configure with
// `connector: "icsCalendar"` and `url` = the .ics feed; pin single-venue
// calendars via defaultVenueSlug. Keeps only upcoming, non-recurring,
// non-"Closed" VEVENTs (recurring masters carry an RRULE we don't expand — they
// tend to be the weekly-special noise — and a calendar entry literally titled
// "Closed …" is never a public event).
const WINDOW_DAYS = 120;

// ICS folds long lines by starting continuations with a space/tab; unfold first.
function unfoldLines(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

// One pass over a VEVENT's lines → property name (up to the first ":" or ";")
// mapped to its full line, first occurrence winning.
function parseProps(lines: string[]): Map<string, string> {
  const props = new Map<string, string>();
  for (const l of lines) {
    const sep = l.search(/[:;]/);
    if (sep === -1) continue;
    const name = l.slice(0, sep);
    if (!props.has(name)) props.set(name, l);
  }
  return props;
}

// Value after a property line's first ":".
function value(line: string | undefined): string {
  return line ? line.slice(line.indexOf(":") + 1) : "";
}

// Decode ICS TEXT escaping.
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

// A DTSTART value → { text } for the normalizer's Date line and { ms } for
// windowing. UTC ("…Z") is converted to Denver-local; a TZID wall-clock is the
// venue's local time already (emit verbatim, per the dedup day-key convention);
// VALUE=DATE is a bare day.
function parseDtStart(line: string): { text: string; ms: number } | null {
  const v = line.slice(line.indexOf(":") + 1).trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) {
    const day = `${y}-${mo}-${d}`;
    return { text: day, ms: Date.parse(`${day}T12:00:00Z`) };
  }
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ?? ""}`;
  return { text: z ? localizeDenver(iso) : `${y}-${mo}-${d} ${h}:${mi}`, ms: Date.parse(iso) };
}

const DAY_NAMES: Record<string, string> = {
  SU: "Sunday", MO: "Monday", TU: "Tuesday", WE: "Wednesday",
  TH: "Thursday", FR: "Friday", SA: "Saturday",
};
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Minutes-since-midnight from a DTSTART/DTEND line ("…T160000" → 960), or null.
function timeMinutes(line: string | undefined): number | null {
  if (!line) return null;
  const m = /T(\d{2})(\d{2})/.exec(line.slice(line.indexOf(":") + 1));
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

// Minutes-since-midnight → 12-hour label (960 → "4:00 PM").
function timeLabel(min: number): string {
  let h = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
}

// A recurring VEVENT → its weekday names + start/end minutes, plus whether the
// series has already ended (UNTIL in the past). Structured so multiple RRULEs
// sharing a title can be merged (union of days, widened time span).
function recurringInfo(
  rruleLine: string,
  dtStartLine: string,
  dtEndLine: string | undefined,
  now: number,
): { days: string[]; startMin: number | null; endMin: number | null; expired: boolean } {
  const rrule = rruleLine.slice(rruleLine.indexOf(":") + 1);
  const until = /UNTIL=(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(rrule);
  const expired = until
    ? Date.parse(
        `${until[1]}-${until[2]}-${until[3]}T${until[4] ?? "23"}:${until[5] ?? "59"}:${until[6] ?? "59"}${until[7] ?? "Z"}`,
      ) < now
    : false;
  const byday = /BYDAY=([^;]+)/.exec(rrule)?.[1];
  const days = (byday ? byday.split(",") : [])
    .map((d) => DAY_NAMES[d.replace(/^[+-]?\d*/, "")])
    .filter(Boolean);
  return { days, startMin: timeMinutes(dtStartLine), endMin: timeMinutes(dtEndLine), expired };
}

// Human schedule line for a (possibly merged) recurring entry. Phrased as an
// ongoing offering with no fixed end so the normalizer marks it recurring (→ a
// rolling visibility window for deals and a stable title+venue dedup key)
// rather than a one-time event on the next occurrence.
function formatRecurring(days: string[], startMin: number | null, endMin: number | null): string {
  const ordered = [...new Set(days)].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  const when = ordered.length ? `every ${ordered.join(", ")}` : "weekly";
  const time =
    startMin != null ? `, ${timeLabel(startMin)}${endMin != null ? `–${timeLabel(endMin)}` : ""}` : "";
  return `Ongoing weekly offering — ${when}${time}, with no fixed end date`;
}

// First http(s) link in a string (e.g. the "Latest event details: <url>" line
// many ICS generators put in DESCRIPTION). Trailing sentence punctuation is
// trimmed so the link resolves.
function firstUrl(s: string): string | null {
  const m = s.match(/https?:\/\/[^\s)<>"']+/);
  return m ? m[0].replace(/[.,;]+$/, "") : null;
}

export async function fetchIcsCalendar(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single ics url`);
  }
  const feedUrl = source.url;
  const ics = await fetchText(feedUrl);

  // Split into VEVENT blocks.
  const blocks: string[][] = [];
  let cur: string[] | null = null;
  for (const l of unfoldLines(ics)) {
    if (l === "BEGIN:VEVENT") cur = [];
    else if (l === "END:VEVENT") {
      if (cur) blocks.push(cur);
      cur = null;
    } else if (cur) cur.push(l);
  }

  const now = Date.now();
  const horizon = now + WINDOW_DAYS * 86400000;
  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const scored: Array<{ item: RawItem; ms: number }> = [];

  // Recurring entries are accumulated and merged by title: one offering is often
  // split across several RRULEs (e.g. a happy hour as a Tue–Thu entry plus a
  // separate Fri entry). Merging unions the days and widens the time span so it
  // lands as ONE deal rather than duplicate listings.
  const recurringGroups = new Map<
    string,
    {
      summary: string;
      days: string[];
      startMin: number | null;
      endMin: number | null;
      venueName: string;
      address: string;
      description: string;
    }
  >();

  for (const b of blocks) {
    const props = parseProps(b);
    if (/cancel/i.test(value(props.get("STATUS")))) continue;
    const summary = unescapeText(value(props.get("SUMMARY")));
    if (!summary || /^closed\b/i.test(summary)) continue; // closures aren't events
    const dtLine = props.get("DTSTART");
    if (!dtLine) continue;

    // Single-venue calendars often omit LOCATION on each entry (the venue is
    // implied). Fall back to the source's defaultVenueName + defaultVenueAddress
    // so those events still pin to a venue AND geocode (a name-only lookup
    // returns nothing → the venue lands with null coords and a wrong default
    // neighborhood). Set both on the RawItem (mapRawEvent uses item.venueName /
    // item.address when the LLM doesn't extract them). Calendars pinned via
    // defaultVenueSlug don't set these, so they're unaffected.
    const location = unescapeText(value(props.get("LOCATION")));
    const description = unescapeText(value(props.get("DESCRIPTION")));
    // Link the listing to the event's own page (VEVENT URL, else a link in the
    // description) instead of the raw .ics feed, which renders as a wall of text.
    const eventUrl = value(props.get("URL")) || firstUrl(description) || feedUrl;
    const venueName = location || source.defaultVenueName || "";
    const address = location ? "" : source.defaultVenueAddress || "";

    // Recurring master (RRULE). By default skipped — they tend to be weekly
    // noise. Opt in with `icsIncludeRecurring` to keep ACTIVE series (a happy
    // hour, weekly trivia), accumulated/merged by title; expired (UNTIL) series
    // are dropped.
    if (props.has("RRULE")) {
      if (!source.icsIncludeRecurring) continue;
      const info = recurringInfo(props.get("RRULE")!, dtLine, props.get("DTEND"), now);
      if (info.expired) continue;
      const key = summary.toLowerCase();
      const g = recurringGroups.get(key);
      if (g) {
        g.days.push(...info.days);
        if (info.startMin != null) g.startMin = g.startMin == null ? info.startMin : Math.min(g.startMin, info.startMin);
        if (info.endMin != null) g.endMin = g.endMin == null ? info.endMin : Math.max(g.endMin, info.endMin);
      } else {
        recurringGroups.set(key, {
          summary,
          days: [...info.days],
          startMin: info.startMin,
          endMin: info.endMin,
          venueName,
          address,
          description,
        });
      }
      continue;
    }

    // One-off dated event: upcoming only.
    const start = parseDtStart(dtLine);
    if (!start) continue;
    if (start.ms < now - 86400000 || start.ms > horizon) continue;
    const uid = value(props.get("UID")) || `${summary}@${start.text}`;
    const sourceId = `${source.id}:${createHash("sha1").update(uid).digest("hex").slice(0, 16)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const text = [summary, `Date: ${start.text}`, venueName && `Venue: ${venueName}`, address && `Address: ${address}`, description]
      .filter(Boolean)
      .join("\n");
    scored.push({
      item: { sourceId, sourceUrl: eventUrl, text, fetchedAt, venueName: venueName || undefined, address: address || undefined },
      ms: start.ms,
    });
  }

  // Emit one merged listing per recurring title. Keyed on the title (not the
  // per-RRULE UID) so the sourceId is stable across runs and the merged entry
  // can't re-split into duplicates.
  for (const [key, g] of recurringGroups) {
    const sourceId = `${source.id}:${createHash("sha1").update(`recurring:${key}`).digest("hex").slice(0, 16)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const text = [g.summary, formatRecurring(g.days, g.startMin, g.endMin), g.venueName && `Venue: ${g.venueName}`, g.address && `Address: ${g.address}`, g.description]
      .filter(Boolean)
      .join("\n");
    scored.push({
      item: { sourceId, sourceUrl: firstUrl(g.description) || feedUrl, text, fetchedAt, venueName: g.venueName || undefined, address: g.address || undefined, recurring: true },
      ms: now,
    });
  }

  // Soonest first, then cap — the feed isn't date-ordered.
  scored.sort((a, b) => a.ms - b.ms);
  const out = scored.map((s) => s.item);
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
