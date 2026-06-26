"use client";

import { useMemo } from "react";
import { Pill } from "@/components/ui/Pill";
import { Popover, DropdownChevron } from "@/components/ui/Popover";
import { DATE_PRESETS } from "@/lib/filters/types";
import type { DatePreset } from "@/lib/types";

interface Props {
  value: DatePreset;
  from?: string;
  to?: string;
  onChange: (next: { date: DatePreset; from?: string; to?: string }) => void;
}

export function DateDropdown({ value, from, to, onChange }: Props) {
  const displayLabel = useMemo(() => {
    if (value === "any") return "Date";
    if (value === "custom") {
      if (from && to) return `${from} – ${to}`;
      if (from) return `From ${from}`;
      if (to) return `Until ${to}`;
      return "Custom Range";
    }
    return DATE_PRESETS.find((p) => p.id === value)?.label ?? "Date";
  }, [value, from, to]);

  const isActive = value !== "any";
  const customExpanded = value === "custom";

  return (
    <Popover
      panelClassName="border-border min-w-[220px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border bg-white shadow-lg"
      trigger={({ open, toggle }) => (
        <Pill active={isActive} onClick={toggle}>
          {displayLabel}
          <DropdownChevron open={open} />
        </Pill>
      )}
    >
      {(close) => {
        const handlePresetClick = (id: DatePreset) => {
          if (id === "custom") {
            onChange({ date: "custom", from, to });
            return;
          }
          onChange({ date: id, from: undefined, to: undefined });
          close();
        };
        return (
          <>
            <div className="py-1">
              {DATE_PRESETS.map((opt) => {
                const isCustom = opt.id === "custom";
                const isSelected = opt.id === value;
                return (
                  <div key={opt.id}>
                    {isCustom && <div className="border-border my-1 border-t" />}
                    <button
                      type="button"
                      onClick={() => handlePresetClick(opt.id)}
                      className={`hover:bg-tag-bg block w-full px-4 py-2 text-left text-[13px] font-normal transition-colors ${
                        isSelected ? "text-dark bg-tag-bg" : "text-graphite"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </div>
                );
              })}
            </div>
            {customExpanded && (
              <div className="border-border border-t px-4 py-4">
                <div className="flex gap-3">
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="text-gray text-[12px] font-normal">From</span>
                    <input
                      type="date"
                      value={from ?? ""}
                      onChange={(e) =>
                        onChange({ date: "custom", from: e.target.value || undefined, to })
                      }
                      className="border-border text-dark rounded-xl border px-3 py-2 text-[13px] focus:border-dark focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="text-gray text-[12px] font-normal">To</span>
                    <input
                      type="date"
                      value={to ?? ""}
                      onChange={(e) =>
                        onChange({ date: "custom", from, to: e.target.value || undefined })
                      }
                      className="border-border text-dark rounded-xl border px-3 py-2 text-[13px] focus:border-dark focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            )}
          </>
        );
      }}
    </Popover>
  );
}
