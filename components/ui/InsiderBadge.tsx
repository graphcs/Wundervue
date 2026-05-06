interface Props {
  size?: "sm" | "md";
}

export function InsiderBadge({ size = "md" }: Props) {
  const dim =
    size === "sm"
      ? "px-1.5 py-0.5 text-[9px]"
      : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`bg-coral text-white font-bold uppercase tracking-wider rounded-full inline-flex items-center gap-1 ${dim}`}
    >
      <svg
        width={size === "sm" ? 8 : 10}
        height={size === "sm" ? 8 : 10}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
      </svg>
      Insider
    </span>
  );
}
