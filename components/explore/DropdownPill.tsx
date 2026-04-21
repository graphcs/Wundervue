"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";

interface Option<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  activeLabel?: ReactNode;
}

export function DropdownPill<T extends string>({
  label,
  options,
  value,
  onChange,
  activeLabel,
}: Props<T>) {
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

  const selected = options.find((o) => o.id === value);
  const displayLabel =
    activeLabel ?? (selected && selected.id !== options[0]?.id
      ? selected.label
      : label);
  const isActive = selected ? selected.id !== options[0]?.id : false;

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
        <div className="border-border absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border bg-white shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-tag-bg ${
                opt.id === value ? "text-coral font-bold" : "text-dark"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
