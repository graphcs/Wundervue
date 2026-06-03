"use client";

import {
  AuthRequiredError,
  FavoriteLimitReached,
  useFavorites,
} from "@/lib/hooks/useFavorites";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { HeartIcon } from "./icons";

interface Props {
  listingId: string;
}

export function FavoriteToggle({ listingId }: Props) {
  const { isFavorited, toggle, hydrated } = useFavorites();
  const { user } = useAuth();
  const { openUpgrade, openOnboarding } = useAuthContext();
  const active = hydrated && isFavorited(listingId);

  const handleClick = () => {
    try {
      toggle(listingId, { plan: user?.plan });
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        openOnboarding(0);
      } else if (err instanceof FavoriteLimitReached) {
        openUpgrade();
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      className={`rounded-pill flex-1 border-[1.5px] px-4 py-3 text-[13px] font-medium transition-colors ${
        active
          ? "bg-dark border-dark text-white"
          : "border-dark text-dark hover:bg-dark hover:text-white"
      }`}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        <HeartIcon size={14} filled={active} />
        {active ? "Saved" : "Favorite"}
      </span>
    </button>
  );
}
