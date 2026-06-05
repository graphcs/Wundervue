// Minimal iCalendar (.ics) feed generator for the Calendar Sync feature.
// Pure + deterministic (callers pass `dtstamp`) so it's easy to unit-test.

export interface IcsEvent {
  id: string;
  title: string;
  startAt: string; // ISO timestamp
  endAt?: string | null; // ISO timestamp
  description?: string | null;
  location?: string | null;
  url?: string | null;
}

// Escape per RFC 5545: backslash, newline, comma, semicolon.
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// ISO → UTC basic format YYYYMMDDTHHMMSSZ. Returns null for unparseable input.
export function toIcsDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

export function buildIcsFeed(
  events: IcsEvent[],
  opts: { calName: string; dtstamp: string },
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wundervue//Saved Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.calName)}`,
  ];
  for (const e of events) {
    const start = toIcsDate(e.startAt);
    if (!start) continue; // skip events with no usable start
    const end = e.endAt ? toIcsDate(e.endAt) : null;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@wundervue`);
    lines.push(`DTSTAMP:${opts.dtstamp}`);
    lines.push(`DTSTART:${start}`);
    if (end) lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    const desc = [e.description, e.url].filter(Boolean).join("\n");
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
