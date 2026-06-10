// Render a UTC ISO instant as a venue-local ("America/Denver") human string,
// e.g. "Fri, Jun 26, 2026, 7:00 PM" — the format the normalizer reads from a
// connector's "Date:" line. Falls back to the raw input if it can't be parsed.
// Wundervue is Denver-only, so the timezone is fixed (matches every connector
// that previously inlined this).
export function localizeDenver(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Denver",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
