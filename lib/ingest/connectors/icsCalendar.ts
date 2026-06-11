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

  for (const b of blocks) {
    const props = parseProps(b);
    if (props.has("RRULE")) continue; // recurring master — skip
    if (/cancel/i.test(value(props.get("STATUS")))) continue;
    const summary = unescapeText(value(props.get("SUMMARY")));
    if (!summary || /^closed\b/i.test(summary)) continue; // closures aren't events
    const dtLine = props.get("DTSTART");
    if (!dtLine) continue;
    const start = parseDtStart(dtLine);
    if (!start) continue;
    // Upcoming only: drop anything before yesterday or past the window.
    if (start.ms < now - 86400000 || start.ms > horizon) continue;

    const uid = value(props.get("UID")) || `${summary}@${start.text}`;
    const sourceId = `${source.id}:${createHash("sha1").update(uid).digest("hex").slice(0, 16)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const location = unescapeText(value(props.get("LOCATION")));
    const description = unescapeText(value(props.get("DESCRIPTION")));
    const text = [summary, `Date: ${start.text}`, location && `Venue: ${location}`, description]
      .filter(Boolean)
      .join("\n");
    scored.push({ item: { sourceId, sourceUrl: feedUrl, text, fetchedAt }, ms: start.ms });
  }

  // Soonest first, then cap — the feed isn't date-ordered.
  scored.sort((a, b) => a.ms - b.ms);
  const out = scored.map((s) => s.item);
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
