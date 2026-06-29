import { resolveTicketCta } from "@/lib/tickets";

interface Props {
  ticketUrl?: string;
  sourceUrl?: string;
}

export function TicketButton({ ticketUrl, sourceUrl }: Props) {
  const cta = resolveTicketCta(ticketUrl, sourceUrl);
  if (!cta) return null;
  const style = cta.primary
    ? "bg-dark text-white hover:bg-black"
    : "border-[1.5px] border-dark text-dark hover:bg-dark hover:text-white";
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`rounded-pill flex w-full items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold transition-colors ${style}`}
    >
      {cta.label}
    </a>
  );
}
