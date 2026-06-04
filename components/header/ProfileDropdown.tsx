"use client";

import Link from "next/link";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useFavorites } from "@/lib/hooks/useFavorites";
import { useFollowedVenues } from "@/lib/hooks/useFollowedVenues";

interface Props {
  onClose: () => void;
}

function MenuIcon({ path }: { path: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

export function ProfileDropdown({ onClose }: Props) {
  const {
    profile,
    signOut,
    openSavedEvents,
    openSavedVenues,
    openUpgrade,
    openManageSub,
  } = useAuthContext();
  const { favorites } = useFavorites();
  const { followed } = useFollowedVenues();

  if (!profile) return null;

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  return (
    <div className="border-border absolute right-0 top-[44px] z-50 w-[280px] overflow-hidden rounded-xl border bg-white shadow-xl">
      <div className="border-border border-b px-4 py-3">
        <div className="text-dark text-sm font-medium">{profile.name}</div>
        <div className="text-gray mt-0.5 truncate text-[12px]">{profile.email}</div>
        {profile.plan === "insider" && (
          <span className="bg-coral mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Insider
          </span>
        )}
      </div>

      <div className="flex flex-col py-1">
        <button
          type="button"
          onClick={() => run(openSavedEvents)}
          className="hover:bg-tag-bg text-dark flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors"
        >
          <span className="inline-flex items-center gap-2.5">
            <MenuIcon path={<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />} />
            Saved Events
          </span>
          <span className="bg-tag-bg text-gray rounded-full px-2 text-[11px] font-medium">
            {favorites.size}
          </span>
        </button>

        <button
          type="button"
          onClick={() => run(openSavedVenues)}
          className="hover:bg-tag-bg text-dark flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors"
        >
          <span className="inline-flex items-center gap-2.5">
            <MenuIcon path={<><path d="M3 9.5 12 3l9 6.5V21a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z" /><polyline points="9 22 9 12 15 12 15 22" /></>} />
            Saved Venues
          </span>
          <span className="bg-tag-bg text-gray rounded-full px-2 text-[11px] font-medium">
            {followed.size}
          </span>
        </button>

        <Link
          href="/account"
          onClick={onClose}
          className="hover:bg-tag-bg text-dark flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors"
        >
          <MenuIcon path={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>} />
          Account
        </Link>

        {profile.plan === "free" ? (
          <button
            type="button"
            onClick={() => run(openUpgrade)}
            className="hover:bg-tag-bg text-coral flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors"
          >
            <MenuIcon path={<><rect x="2" y="5" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="10" x2="22" y2="10" /></>} />
            Upgrade to Insider
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(openManageSub)}
            className="hover:bg-tag-bg text-dark flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors"
          >
            <MenuIcon path={<><rect x="2" y="5" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="10" x2="22" y2="10" /></>} />
            Manage Subscription
          </button>
        )}

        <div className="border-border mt-1 border-t pt-1">
          <button
            type="button"
            onClick={handleLogout}
            className="hover:bg-tag-bg text-gray flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors"
          >
            <MenuIcon path={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>} />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
