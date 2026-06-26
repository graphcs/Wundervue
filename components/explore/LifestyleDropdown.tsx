"use client";

import { LIFESTYLE_TAGS } from "@/lib/filters/types";
import type { LifestyleTag } from "@/lib/types";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Pill } from "@/components/ui/Pill";
import { Popover, DropdownChevron } from "@/components/ui/Popover";

interface Props {
  selected: LifestyleTag[];
  onToggle: (tag: LifestyleTag) => void;
}

// One "Lifestyle ▾" multi-select dropdown replacing the four loose lifestyle
// pills. Insider-gated, shared by the explore feed and the venue filter bars.
export function LifestyleDropdown({ selected, onToggle }: Props) {
  const { profile, isLoggedIn, openUpgrade } = useAuthContext();
  const gated = !isLoggedIn || profile?.plan !== "insider";
  const count = selected.length;
  const label = count > 0 ? `Lifestyle (${count})` : "Lifestyle";

  // Gated: the control is a plain pill that opens the upgrade prompt — never the
  // menu — so a free user can't apply a paid filter.
  if (gated) {
    return (
      <Pill active={false} onClick={openUpgrade} title="Lifestyle filters — Insider only">
        {label}
        <DropdownChevron open={false} />
      </Pill>
    );
  }

  return (
    <Popover
      panelClassName="border-border min-w-[200px] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border bg-white shadow-lg"
      trigger={({ open, toggle }) => (
        <Pill active={count > 0} onClick={toggle}>
          {label}
          <DropdownChevron open={open} />
        </Pill>
      )}
    >
      {() =>
        LIFESTYLE_TAGS.map((tag) => {
          const checked = selected.includes(tag.id);
          return (
            <label
              key={tag.id}
              className="hover:bg-tag-bg flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(tag.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                  checked ? "bg-dark border-dark" : "border-chrome bg-white"
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
              <span className="text-[13px] leading-none">{tag.emoji}</span>
              <span className="text-dark font-normal">{tag.label}</span>
            </label>
          );
        })
      }
    </Popover>
  );
}
