"use client";

import { useState } from "react";
import { ReportIssueModal } from "./ReportIssueModal";

// Self-contained client island: a subtle "Report an issue" trigger plus its
// modal. Open to everyone, so no plan/auth gating here.
export function ReportButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gray hover:text-dark inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        Report an issue
      </button>
      <ReportIssueModal open={open} onClose={() => setOpen(false)} listingId={listingId} />
    </>
  );
}
