"use client";

import { useEffect, useRef, useState } from "react";
import { useFilters } from "@/lib/hooks/useFilters";
import { PAGE_SIZE_OPTIONS } from "@/lib/filters/types";
import type { PageSize } from "@/lib/types";

export function PerPagePicker() {
  const { filters, replaceFilters } = useFilters();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = String(filters.pageSize);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border-border text-graphite inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-sm font-medium hover:border-dark"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>Show {current}</span>
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
      </button>
      {open && (
        <div
          role="listbox"
          className="border-border absolute right-0 bottom-full z-50 mb-1 min-w-[120px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border bg-white shadow-lg"
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={opt.id === current}
              onClick={() => {
                replaceFilters({ pageSize: Number(opt.id) as PageSize });
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-tag-bg ${
                opt.id === current ? "text-coral font-bold" : "text-dark"
              }`}
            >
              {opt.label} per page
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
