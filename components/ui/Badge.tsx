import type { ListingType } from "@/lib/types";

interface Props {
  type: ListingType;
  size?: "default" | "sm";
}

const STYLES: Record<ListingType, { bg: string; label: string }> = {
  event: { bg: "bg-dark", label: "EVENT" },
  deal: { bg: "bg-coral", label: "DEAL" },
  both: { bg: "bg-graphite", label: "E+D" },
};

export function Badge({ type, size = "default" }: Props) {
  const { bg, label } = STYLES[type];
  const sizeClasses =
    size === "sm"
      ? "left-1.5 top-1.5 px-1.5 py-0.5 text-[8px] tracking-[0.08em]"
      : "left-2.5 top-2.5 px-2.5 py-1 text-[9px] tracking-[0.12em]";
  return (
    <span
      className={`${bg} absolute z-10 rounded-full font-bold uppercase text-white ${sizeClasses}`}
    >
      {label}
    </span>
  );
}
