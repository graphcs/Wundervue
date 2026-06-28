interface Props {
  size?: "default" | "sm";
}

// "NEW" — shown on a listing whose series was first seen within NEW_WINDOW_DAYS
// (lib/data/freshness.ts). Sits top-left just under the type Badge so a returning
// user can spot fresh events at a glance.
export function NewBadge({ size = "default" }: Props) {
  const sizeClasses =
    size === "sm"
      ? "left-1.5 top-7 px-1.5 py-0.5 text-[8px] tracking-[0.08em]"
      : "left-2.5 top-9 px-2.5 py-1 text-[9px] tracking-[0.12em]";
  return (
    <span
      className={`bg-coral absolute z-10 rounded-full font-bold uppercase text-white ${sizeClasses}`}
    >
      New
    </span>
  );
}
