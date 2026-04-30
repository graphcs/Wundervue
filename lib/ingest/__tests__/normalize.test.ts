import { describe, expect, it, vi } from "vitest";
import { normalize } from "../normalize";
import type { RawItem, SourceConfig } from "../types";

function mockClient(toolInput: Record<string, unknown>) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "tool_use",
            name: "record_listing",
            id: "tu_1",
            input: toolInput,
          },
        ],
      }),
    },
  } as unknown as Parameters<typeof normalize>[0]["client"];
}

const SOURCE: SourceConfig = {
  id: "test-ig",
  enabled: true,
  connector: "instagram",
  cadence: "daily",
  sourceLabel: "Instagram",
  handle: "test",
  defaultVenueSlug: "mission-ballroom",
  defaultCategory: "Music",
};

const ITEM: RawItem = {
  sourceId: "abc123",
  sourceUrl: "https://instagram.com/p/abc123/",
  text: "Live music tonight 8pm at Mission Ballroom! Free entry 🎸",
  fetchedAt: "2027-04-11T02:00:00Z",
};

describe("normalize", () => {
  it("returns null when LLM marks content as not-an-event", async () => {
    const client = mockClient({
      is_event_or_deal: false,
      type: "event",
      title: "",
      canonical_title: "",
      description: "",
      category: "Music",
      neighborhood: "RiNo",
      date_start: null,
      date_end: null,
      date_display: "",
      time_display: "",
      is_free: false,
      deal_value: null,
      tags: [],
    });
    const result = await normalize({ item: ITEM, source: SOURCE, client });
    expect(result).toBeNull();
  });

  it("maps tool input to NormalizedListing", async () => {
    const client = mockClient({
      is_event_or_deal: true,
      type: "event",
      title: "Live Music at Mission Ballroom",
      canonical_title: "live music at mission ballroom",
      description: "Free live music starting at 8pm.",
      category: "Music",
      neighborhood: "RiNo",
      date_start: "2027-04-11T02:00:00Z",
      date_end: null,
      date_display: "Sat, Apr 10",
      time_display: "8:00 PM",
      is_free: true,
      deal_value: null,
      tags: ["date-night"],
    });
    const result = await normalize({ item: ITEM, source: SOURCE, client });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      isEventOrDeal: true,
      type: "event",
      title: "Live Music at Mission Ballroom",
      canonicalTitle: "live music at mission ballroom",
      isFree: true,
      tags: ["date-night"],
      neighborhood: "RiNo",
    });
  });

  it("preserves deal_value for deals", async () => {
    const client = mockClient({
      is_event_or_deal: true,
      type: "deal",
      title: "BOGO Tacos at Lola",
      canonical_title: "bogo tacos at lola",
      description: "Buy one get one free street tacos every Friday.",
      category: "Food & Drink",
      neighborhood: "LoHi",
      date_start: null,
      date_end: null,
      date_display: "Every Friday",
      time_display: "",
      is_free: false,
      deal_value: "BOGO",
      tags: [],
    });
    const result = await normalize({ item: ITEM, source: SOURCE, client });
    expect(result?.dealValue).toBe("BOGO");
    expect(result?.type).toBe("deal");
    expect(result?.dateDisplay).toBe("Every Friday");
  });

  it("returns null when the model returns no tool_use block", async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "I cannot do that." }],
        }),
      },
    } as unknown as Parameters<typeof normalize>[0]["client"];
    const result = await normalize({ item: ITEM, source: SOURCE, client });
    expect(result).toBeNull();
  });
});
