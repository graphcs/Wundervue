import type { LifestyleTag } from "@/lib/types";
import { LIFESTYLE_TAG_BY_ID } from "@/lib/filters/types";

// Renders a listing's lifestyle tags as labeled chips. Viewing tags is open to
// everyone (per the tier matrix); only *filtering* by them is Insider-gated.
// Returns the chip <span>s as a fragment so callers control the surrounding
// layout (a dedicated wrap row on cards, inline in the chip row on detail).
// `size` is the only visual difference between surfaces: cards use "sm".
export function LifestyleTagChips({
  tags,
  size = "md",
}: {
  tags?: LifestyleTag[];
  size?: "sm" | "md";
}) {
  if (!tags || tags.length === 0) return null;
  const pad = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  return (
    <>
      {tags.map((t) => {
        const meta = LIFESTYLE_TAG_BY_ID[t];
        return meta ? (
          <span
            key={t}
            className={`border-border text-graphite inline-flex items-center gap-1 rounded-full border ${pad} text-[11px] font-medium`}
          >
            <span aria-hidden>{meta.emoji}</span>
            {meta.label}
          </span>
        ) : null;
      })}
    </>
  );
}
