export interface TicketCta {
  href: string;
  label: string;
  primary: boolean;
}

// Known ticketing/box-office domains. When a listing's source link already
// points at one of these, it IS a buy-tickets link — so we promote it to the
// prominent CTA even without an explicit ticket_url (covers Ticketmaster/AXS
// sources whose source_url is the ticket page, with no backfill needed).
const TICKETING_HOST_RE =
  /(?:^|\.)(?:ticketmaster\.com|livenation\.com|axs\.com|ticketweb\.com|eventbrite\.com|simpletix\.com|etix\.com|seetickets\.us|dice\.fm|seatgeek\.com|tixr\.com|see\.tickets|comedyworks\.com)$/i;

export function isTicketingUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return TICKETING_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Pure: pick the detail-view action CTA. An explicit ticket link — or a source
// link that's already a ticketing domain — is the prominent "Buy Tickets"
// button; any other source link is a softer "More Info"; null when neither
// exists.
export function resolveTicketCta(
  ticketUrl: string | undefined,
  sourceUrl: string | undefined,
): TicketCta | null {
  if (ticketUrl) return { href: ticketUrl, label: "Buy Tickets", primary: true };
  if (sourceUrl) {
    return isTicketingUrl(sourceUrl)
      ? { href: sourceUrl, label: "Buy Tickets", primary: true }
      : { href: sourceUrl, label: "More Info", primary: false };
  }
  return null;
}
