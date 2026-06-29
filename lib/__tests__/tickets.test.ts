import { describe, expect, it } from "vitest";
import { resolveTicketCta } from "../tickets";

describe("resolveTicketCta", () => {
  it("uses a ticket link as the prominent 'Buy Tickets' CTA", () => {
    expect(resolveTicketCta("https://tm/abc", "https://src/post")).toEqual({
      href: "https://tm/abc",
      label: "Buy Tickets",
      primary: true,
    });
  });

  it("ticket link wins even when there's no source link", () => {
    expect(resolveTicketCta("https://tm/abc", undefined)).toMatchObject({
      label: "Buy Tickets",
      primary: true,
    });
  });

  it("falls back to a softer 'More Info' on a non-ticketing source link", () => {
    expect(resolveTicketCta(undefined, "https://instagram.com/p/abc")).toEqual({
      href: "https://instagram.com/p/abc",
      label: "More Info",
      primary: false,
    });
  });

  it("promotes a ticketing-domain source link to 'Buy Tickets' (no explicit ticket_url)", () => {
    expect(
      resolveTicketCta(undefined, "https://www.ticketmaster.com/event/1E006445A776780D"),
    ).toMatchObject({ label: "Buy Tickets", primary: true });
    expect(
      resolveTicketCta(undefined, "https://www.axs.com/events/123/show-tickets"),
    ).toMatchObject({ label: "Buy Tickets", primary: true });
    // Venues whose own site IS the box office (Comedy Works, Eventbrite/SimpleTix).
    expect(
      resolveTicketCta(undefined, "https://comedyworks.com/comedians/new-talent-night"),
    ).toMatchObject({ label: "Buy Tickets", primary: true });
  });

  it("renders nothing when neither link exists", () => {
    expect(resolveTicketCta(undefined, undefined)).toBeNull();
  });
});
