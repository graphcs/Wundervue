"use client";

import type { FeedTab } from "@/lib/types";
import { useFilters } from "@/lib/hooks/useFilters";
import { useAuthContext } from "@/components/auth/AuthProvider";

const TABS: { id: FeedTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "for-you", label: "✨ For You" },
  { id: "my-events", label: "My Events" },
  { id: "my-venues", label: "My Venues" },
];

// All · For You · My Events · My Venues. For You is Insider-only (→ upgrade);
// My Events and My Venues need a login (→ onboarding). Drives the `tab` URL
// param via useFilters.
export function FeedTabs() {
  const { filters, replaceFilters } = useFilters();
  const { isLoggedIn, profile, openUpgrade, openOnboarding } = useAuthContext();
  const insider = isLoggedIn && profile?.plan === "insider";

  function select(tab: FeedTab) {
    if (tab === "for-you" && !insider) return openUpgrade();
    if ((tab === "my-events" || tab === "my-venues") && !isLoggedIn) return openOnboarding(0);
    replaceFilters({ tab });
  }

  return (
    <div className="border-border flex gap-1 border-b">
      {TABS.map((t) => {
        const active = filters.tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            className={`relative px-4 py-2.5 text-[14px] font-medium transition-colors ${
              active ? "text-dark" : "text-gray hover:text-dark"
            }`}
          >
            {t.label}
            {active && <span className="bg-coral absolute inset-x-2 -bottom-px h-[2px] rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}
