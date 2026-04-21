"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { ProfileDropdown } from "./ProfileDropdown";

export function ProfileIcon() {
  const { hydrated, isLoggedIn, profile, openOnboarding } = useAuthContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!hydrated) {
    return (
      <div
        aria-hidden
        className="border-border flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] opacity-50"
      />
    );
  }

  if (isLoggedIn && profile) {
    const initial = profile.name.trim().charAt(0).toUpperCase() || "U";
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-label="Open profile menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="bg-coral flex h-[34px] w-[34px] items-center justify-center rounded-full text-sm font-medium text-white transition-transform hover:scale-105"
        >
          {initial}
        </button>
        {open && <ProfileDropdown onClose={() => setOpen(false)} />}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label="Sign in"
      onClick={() => openOnboarding(0)}
      className="border-border hover:border-dark flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] bg-white transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#121821"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>
  );
}
