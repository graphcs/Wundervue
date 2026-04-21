interface Props {
  size?: "default" | "sm";
}

export function FreeBadge({ size = "default" }: Props) {
  const sizeClasses =
    size === "sm"
      ? "right-1.5 top-1.5 px-1.5 py-0.5 text-[8px] tracking-[0.06em]"
      : "right-11 top-2.5 px-2 py-1 text-[9px] tracking-[0.08em]";
  return (
    <span
      className={`bg-free-badge absolute z-10 rounded-full font-bold uppercase text-white ${sizeClasses}`}
    >
      FREE
    </span>
  );
}
