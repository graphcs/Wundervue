import { createHash } from "node:crypto";

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
