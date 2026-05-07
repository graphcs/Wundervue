"use client";

import { useFavorites, FavoriteLimitReached } from "@/lib/hooks/useFavorites";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { canAccessListing } from "@/lib/auth/insiderGate";
import type { LifestyleTag } from "@/lib/types";

interface Props {
  listingId: string;
  tags?: LifestyleTag[];
  className?: string;
}

export function FavButton({ listingId, tags, className = "" }: Props) {
  const { isFavorited, toggle, hydrated } = useFavorites();
  const { user } = useAuth();
  const { openUpgrade, profile } = useAuthContext();
  const active = hydrated && isFavorited(listingId);
  const locked = tags ? !canAccessListing({ tags }, profile?.plan) : false;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (locked) {
      openUpgrade();
      return;
    }
    try {
      toggle(listingId, { plan: user?.plan });
    } catch (err) {
      if (err instanceof FavoriteLimitReached) {
        openUpgrade();
      }
    }
  };

  return (
    <button
      type="button"
      aria-label={active ? "Remove from favorites" : "Save to favorites"}
      aria-pressed={active}
      onClick={handleClick}
      className={`absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110 ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={active ? "#121821" : "none"}
        stroke="#121821"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
