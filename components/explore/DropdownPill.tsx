"use client";

import { type ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Popover, DropdownChevron } from "@/components/ui/Popover";

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
  const selected = options.find((o) => o.id === value);
  const isActive = selected ? selected.id !== options[0]?.id : false;
  const displayLabel = activeLabel ?? (isActive ? selected!.label : label);

  return (
    <Popover
      panelClassName="border-border min-w-[180px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border bg-white shadow-lg"
      trigger={({ open, toggle }) => (
        <Pill active={isActive} onClick={toggle}>
          {displayLabel}
          <DropdownChevron open={open} />
        </Pill>
      )}
    >
      {(close) =>
        options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              onChange(opt.id);
              close();
            }}
            className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-tag-bg ${
              opt.id === value ? "text-coral font-bold" : "text-dark"
            }`}
          >
            {opt.label}
          </button>
        ))
      }
    </Popover>
  );
}
