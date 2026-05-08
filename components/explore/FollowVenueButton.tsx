"use client";

import {
  useFollowedVenues,
  FollowLimitReached,
} from "@/lib/hooks/useFollowedVenues";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAuthContext } from "@/components/auth/AuthProvider";

interface Props {
  venueId: string;
}

export function FollowVenueButton({ venueId }: Props) {
  const { isFollowed, toggle, hydrated } = useFollowedVenues();
  const { user } = useAuth();
  const { openUpgrade } = useAuthContext();
  const active = hydrated && isFollowed(venueId);

  const handleClick = () => {
    try {
      toggle(venueId, { plan: user?.plan });
    } catch (err) {
      if (err instanceof FollowLimitReached) {
        openUpgrade();
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      className={`rounded-pill inline-flex items-center gap-1.5 border-[1.5px] px-4 py-2 text-[13px] font-medium transition-colors ${
        active
          ? "bg-dark border-dark text-white"
          : "border-dark text-dark hover:bg-dark hover:text-white"
      }`}
    >
      {active ? (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
      {active ? "Following" : "Follow"}
    </button>
  );
}
