interface Props {
  value?: string;
}

export function DealTag({ value }: Props) {
  if (!value) return null;
  return (
    <span className="text-coral rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: "rgba(255,83,91,0.1)" }}>
      {value}
    </span>
  );
}
