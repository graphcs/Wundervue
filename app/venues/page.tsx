import type { Metadata } from "next";
import { VenuesBrowse } from "@/components/venues/VenuesBrowse";
import { ensureDynamicCities } from "@/lib/data/dynamicCities.server";

export const metadata: Metadata = {
  title: "Venues",
  description:
    "Browse Denver venues — concert halls, breweries, restaurants, and parks hosting events on Wundervue.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VenuesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const dynamicCities = await ensureDynamicCities();

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-8">
      <header className="mb-5">
        <h1 className="text-dark text-[28px] font-medium leading-tight">Denver Venues</h1>
        <p className="text-gray mt-1 text-[14px]">
          Follow your favorite places to keep up with their upcoming events.
        </p>
      </header>

      <VenuesBrowse
        sp={sp}
        mine={sp.mine === "1"}
        basePath="/venues"
        sticky={{}}
        showMineToggle
        dynamicCities={dynamicCities}
      />
    </div>
  );
}
