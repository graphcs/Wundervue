import { Suspense } from "react";
import { DiscoveryBar } from "@/components/explore/DiscoveryBar";
import { VenueHeaderOverlay } from "@/components/explore/VenueHeaderOverlay";

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<div className="h-[66px]" />}>
        <DiscoveryBar />
      </Suspense>
      <div className="mx-auto max-w-[1100px] px-7 py-8">
        <Suspense fallback={null}>
          <VenueHeaderOverlay />
        </Suspense>
        {children}
      </div>
    </>
  );
}
