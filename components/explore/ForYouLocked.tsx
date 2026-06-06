"use client";

import { useAuthContext } from "@/components/auth/AuthProvider";

// Shown when a free user (or guest) lands on the For You view. Mirrors the
// "visible but grayed" treatment in the tier matrix: the tab is reachable, but
// the personalized feed is Insider-only.
export function ForYouLocked() {
  const { isLoggedIn, openUpgrade, openOnboarding } = useAuthContext();
  return (
    <div className="border-coral mx-auto mt-8 max-w-md rounded-2xl border-2 bg-white p-8 text-center">
      <h2 className="text-dark text-[18px] font-medium">For You is an Insider feature</h2>
      <p className="text-gray mx-auto mt-1.5 max-w-sm text-[14px]">
        Upgrade to Insider for a feed personalized to your interests, neighborhoods, and the lifestyle tags you love.
      </p>
      <button
        type="button"
        onClick={() => (isLoggedIn ? openUpgrade() : openOnboarding(0))}
        className="bg-dark rounded-pill mt-5 px-6 py-3 text-[13px] font-medium text-white hover:opacity-90"
      >
        {isLoggedIn ? "Upgrade to Insider" : "Sign up & Upgrade"}
      </button>
    </div>
  );
}
