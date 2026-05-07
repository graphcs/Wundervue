import type { Metadata } from "next";
import Link from "next/link";
import { VENUES } from "@/lib/data/venues";
import { getVenueImageMapBySlug } from "@/lib/data/listings.server";

export const metadata: Metadata = {
  title: "Venues",
  description:
    "Browse Denver venues — concert halls, breweries, restaurants, and parks hosting events on Wundervue.",
};

// Reads from Supabase via the auth-aware server client (cookies()), so
// statically prerendering would require pulling cookies at build time.
// Render per-request instead — the page is small and the data is fresh.
export const dynamic = "force-dynamic";

function PinIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default async function VenuesPage() {
  const sorted = [...VENUES].sort((a, b) => a.name.localeCompare(b.name));
  const imageMap = await getVenueImageMapBySlug();

  return (
    <div className="mx-auto max-w-[1100px] px-7 py-8">
      <header className="mb-6">
        <h1 className="text-dark text-[28px] font-medium leading-tight">
          Denver Venues
        </h1>
        <p className="text-gray mt-1 text-[14px]">
          Follow your favorite places to keep up with their upcoming events.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((venue) => {
          const imageUrl = imageMap.get(venue.slug);
          return (
          <li key={venue.id}>
            <Link
              href={`/venues/${venue.slug}`}
              className="group border-border flex h-full flex-col overflow-hidden rounded-xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className="bg-tag-bg relative flex h-[140px] w-full items-center justify-center overflow-hidden"
                style={
                  imageUrl
                    ? undefined
                    : {
                        background:
                          "linear-gradient(135deg, #ffe9ea 0%, #fff5e6 100%)",
                      }
                }
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={venue.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-coral text-[22px] font-medium tracking-tight">
                    {venue.name}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-tag-bg text-graphite rounded-full px-2.5 py-1 text-[11px] font-medium">
                    {venue.neighborhood}
                  </span>
                </div>
                <p className="text-graphite line-clamp-3 text-[13px] leading-snug">
                  {venue.description}
                </p>
                <div className="text-gray mt-auto flex items-center gap-1.5 pt-1 text-[11px]">
                  <PinIcon />
                  <span className="line-clamp-1">{venue.address}</span>
                </div>
              </div>
            </Link>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
