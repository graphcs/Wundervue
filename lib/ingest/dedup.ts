import { createHash } from "node:crypto";

// Precondition: dateStart must be a UTC ISO string. We hash the YYYY-MM-DD
// prefix, so the same instant expressed in different timezone offsets would
// hash to different keys (e.g. "2027-04-11T02:00:00Z" vs "2027-04-10T22:00:00-04:00").
// The normalize step is responsible for emitting UTC; do not weaken this.
export function eventKey(args: {
  canonicalTitle: string;
  venueId: string | null;
  dateStart: string | null;
}): string {
  const day = args.dateStart ? args.dateStart.slice(0, 10) : "no-date";
  const venue = args.venueId ?? "no-venue";
  const payload = `${args.canonicalTitle}|${venue}|${day}`;
  return createHash("sha256").update(payload).digest("hex");
}

export function makeSlug(title: string, sourceId: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const tail = createHash("sha256").update(sourceId).digest("hex").slice(0, 6);
  return `${base || "listing"}-${tail}`;
}
