import { Suspense } from "react";
import { DiscoveryBar } from "@/components/explore/DiscoveryBar";
import { VenueHeaderOverlay } from "@/components/explore/VenueHeaderOverlay";
import { ensureDynamicCities } from "@/lib/data/dynamicCities.server";

export default async function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dynamicCities = await ensureDynamicCities();
  return (
    <>
      <Suspense fallback={<div className="h-[66px]" />}>
        <DiscoveryBar dynamicCities={dynamicCities} />
      </Suspense>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-7 py-8">
        <Suspense fallback={null}>
          <VenueHeaderOverlay />
        </Suspense>
        {children}
      </div>
    </>
  );
}
