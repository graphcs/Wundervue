"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { SORT_OPTIONS } from "@/lib/filters/types";
import type { SortOption } from "@/lib/types";

interface Props {
  value: SortOption;
  onChange: (v: SortOption) => void;
}

export function SortDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.id === value) ?? SORT_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <Pill active={value !== "soonest"} onClick={() => setOpen((v) => !v)}>
        Sort: {current.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Pill>
      {open && (
        <div className="border-border absolute left-0 top-full z-50 mt-1 min-w-[160px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border bg-white py-1 shadow-lg">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id as SortOption);
                setOpen(false);
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
          ))}
        </div>
      )}
    </div>
  );
}
