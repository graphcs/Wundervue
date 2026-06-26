"use client";

import { Pill } from "@/components/ui/Pill";
import { Popover, DropdownChevron } from "@/components/ui/Popover";
import { SORT_OPTIONS } from "@/lib/filters/types";
import type { SortOption } from "@/lib/types";

interface Props {
  value: SortOption;
  onChange: (v: SortOption) => void;
}

export function SortDropdown({ value, onChange }: Props) {
  const current = SORT_OPTIONS.find((o) => o.id === value) ?? SORT_OPTIONS[0];

  return (
    <Popover
      panelClassName="border-border min-w-[160px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border bg-white py-1 shadow-lg"
      trigger={({ open, toggle }) => (
        <Pill active={value !== "soonest"} onClick={toggle}>
          Sort: {current.label}
          <DropdownChevron open={open} />
        </Pill>
      )}
    >
      {(close) =>
        SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              onChange(opt.id as SortOption);
              close();
            }}
            className={`hover:bg-tag-bg flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
              opt.id === value ? "text-dark font-medium" : "text-graphite"
            }`}
          >
            {opt.label}
            {opt.id === value && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))
      }
    </Popover>
  );
}
