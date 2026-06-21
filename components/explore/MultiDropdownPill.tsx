"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "@/components/ui/Pill";

interface Option {
  slug: string;
  label: string;
}

interface Props {
  label: string;
  options: readonly Option[];
  selected: string[];
  onToggle: (slug: string) => void;
}

export function MultiDropdownPill({
  label,
  options,
  selected,
  onToggle,
}: Props) {
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

  const count = selected.length;
  const isActive = count > 0;
  const displayLabel = count > 0 ? `${label} (${count})` : label;

  return (
    <div ref={ref} className="relative">
      <Pill active={isActive} onClick={() => setOpen((v) => !v)}>
        {displayLabel}
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
        <div className="border-border absolute left-0 top-full z-50 mt-1 min-w-[220px] max-w-[calc(100vw-1.5rem)] max-h-[320px] overflow-y-auto rounded-lg border bg-white shadow-lg">
          {options.map((opt) => {
            const checked = selected.includes(opt.slug);
            return (
              <label
                key={opt.slug}
                className="hover:bg-tag-bg flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt.slug)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                    checked
                      ? "bg-dark border-dark"
                      : "border-chrome bg-white"
                  }`}
                >
                  {checked && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="text-dark font-normal">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
