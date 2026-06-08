"use client";

import type { ViewMode } from "@/lib/types";

const VIEW_OPTIONS: { id: ViewMode; label: string; insider: boolean }[] = [
  { id: "grid", label: "Grid", insider: false },
  { id: "map", label: "Map", insider: true },
  { id: "calendar", label: "Calendar", insider: true },
];

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  isInsider: boolean;
  onLocked: () => void;
}

// Grid/Map/Calendar toggle for saved-event views (Map & Calendar are Insider).
// Shared by the homepage My Events tab and the account Saved tab.
export function SavedViewToggle({ value, onChange, isInsider, onLocked }: Props) {
  return (
    <div className="border-border flex rounded-pill border p-0.5">
      {VIEW_OPTIONS.map((o) => {
        const active = value === o.id;
        const locked = o.insider && !isInsider;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => (locked ? onLocked() : onChange(o.id))}
            title={locked ? "Map & Calendar views are an Insider feature" : undefined}
            className={`rounded-pill px-3 py-1 text-[12px] font-medium transition-colors ${
              active ? "bg-dark text-white" : "text-graphite hover:text-dark"
            } ${locked ? "opacity-60" : ""}`}
          >
            {o.label}
            {locked ? " · Insider" : ""}
          </button>
        );
      })}
    </div>
  );
}
