import type { Listing } from "@/lib/types";
import { toIcsDate } from "@/lib/calendar/ics";

// Google Calendar's template URL uses the same UTC basic format as iCalendar.
function toGoogleDateTime(iso: string): string {
  return toIcsDate(iso) ?? "";
}

export function buildCalendarUrl(listing: Listing): string {
  const start = toGoogleDateTime(listing.startAt);
  const endIso = listing.endAt ?? listing.startAt;
  const end = toGoogleDateTime(
    listing.endAt
      ? endIso
      : new Date(new Date(listing.startAt).getTime() + 60 * 60 * 1000).toISOString(),
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: listing.title,
    details: listing.description,
    location: listing.address,
    dates: `${start}/${end}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildDirectionsUrl(address: string): string {
  const params = new URLSearchParams({
    api: "1",
    destination: address,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildShareUrl(listing: Listing): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const path = listing.type === "deal" ? "/deals" : "/events";
  return `${base}${path}/${listing.slug}`;
}
