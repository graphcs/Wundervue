"use client";

import { LIFESTYLE_TAGS } from "@/lib/filters/types";
import type { LifestyleTag } from "@/lib/types";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Pill } from "@/components/ui/Pill";

interface Props {
  selected: LifestyleTag[];
  onToggle: (tag: LifestyleTag) => void;
}

// Insider-gated lifestyle filter pills. Shared by the explore feed and the venue
// filter bars so the tier rule and the pill markup live in one place. Renders a
// fragment of pills; the parent owns any surrounding divider/layout.
export function LifestyleFilterPills({ selected, onToggle }: Props) {
  const { profile, isLoggedIn, openUpgrade } = useAuthContext();
  const gated = !isLoggedIn || profile?.plan !== "insider";

  return (
    <>
      {LIFESTYLE_TAGS.map((tag) => (
        <Pill
          key={tag.id}
          active={selected.includes(tag.id)}
          onClick={() => (gated ? openUpgrade() : onToggle(tag.id))}
          title={gated ? "Lifestyle filters — Insider only" : undefined}
        >
          <span className="text-[13px] leading-none">{tag.emoji}</span>
          {tag.label}
        </Pill>
      ))}
    </>
  );
}
