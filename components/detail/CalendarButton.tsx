"use client";

import type { Listing } from "@/lib/types";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { buildCalendarUrl } from "@/lib/links";
import { CalendarIcon } from "./icons";

const BASE =
  "rounded-pill inline-flex items-center justify-center gap-2 border-[1.5px] px-4 py-3 text-[13px] font-medium transition-colors";

// "Save to Google Calendar" is part of the Insider-only Calendar Sync feature
// (per the tier matrix), so free users get a grayed control that opens the
// upgrade prompt instead of the calendar link.
export function CalendarButton({ listing }: { listing: Listing }) {
  const { profile, openUpgrade } = useAuthContext();
  const isInsider = profile?.plan === "insider";

  if (!isInsider) {
    return (
      <button
        type="button"
        onClick={openUpgrade}
        className={`${BASE} border-border text-gray bg-white hover:border-dark`}
      >
        <CalendarIcon size={14} />
        Save to Google Calendar · Insider
      </button>
    );
  }

  return (
    <a
      href={buildCalendarUrl(listing)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${BASE} border-dark text-dark hover:bg-dark bg-white hover:text-white`}
    >
      <CalendarIcon size={14} />
      Save to Google Calendar
    </a>
  );
}
