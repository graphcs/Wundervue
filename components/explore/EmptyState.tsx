"use client";

import Link from "next/link";

export function EmptyState() {
  return (
    <div className="border-border flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <div className="bg-tag-bg flex h-14 w-14 items-center justify-center rounded-full">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#86898a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h3 className="text-dark text-lg font-medium">No matches</h3>
      <p className="text-gray max-w-xs text-sm">
        Try broadening your filters or clearing the lifestyle pills to see more
        events and deals.
      </p>
      <Link
        href="/explore"
        className="text-coral mt-2 text-sm font-bold hover:underline"
      >
        Clear all filters →
      </Link>
    </div>
  );
}
