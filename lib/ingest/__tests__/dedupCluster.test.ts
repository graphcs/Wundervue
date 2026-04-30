import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { clusterCandidates } from "../dedupCluster";

interface CandidateRow {
  id: string;
  title: string;
  description: string;
  source: string;
  venue_id: string | null;
  address: string | null;
  date_start: string | null;
  event_key: string;
  created_at: string;
}

function mockClient(input: { groups: number[][] }): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          { type: "tool_use", name: "cluster_duplicates", id: "tu_1", input },
        ],
      }),
    },
  } as unknown as Anthropic;
}

const candidate = (overrides: Partial<CandidateRow>): CandidateRow => ({
  id: "id",
  title: "title",
  description: "desc",
  source: "Instagram",
  venue_id: "v1",
  address: null,
  date_start: "2027-04-11T02:00:00Z",
  event_key: "ek",
  created_at: "2027-04-10T00:00:00Z",
  ...overrides,
});

describe("clusterCandidates", () => {
  it("returns no groups for fewer than 2 candidates", async () => {
    const client = mockClient({ groups: [[0, 1]] });
    const result = await clusterCandidates([candidate({ id: "a" })], client);
    expect(result.groups).toEqual([]);
  });

  it("returns groups from the LLM tool response", async () => {
    const client = mockClient({ groups: [[0, 1]] });
    const result = await clusterCandidates(
      [
        candidate({ id: "a", title: "Indie Night", source: "Instagram" }),
        candidate({ id: "b", title: "Indie Showcase", source: "Website" }),
      ],
      client,
    );
    expect(result.groups).toEqual([[0, 1]]);
  });

  it("returns empty groups when LLM produces no tool_use block", async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "no clusters" }],
        }),
      },
    } as unknown as Anthropic;
    const result = await clusterCandidates(
      [candidate({ id: "a" }), candidate({ id: "b" })],
      client,
    );
    expect(result.groups).toEqual([]);
  });

  it("handles three-way clusters", async () => {
    const client = mockClient({ groups: [[0, 1, 2]] });
    const result = await clusterCandidates(
      [
        candidate({ id: "a", source: "Instagram" }),
        candidate({ id: "b", source: "Website" }),
        candidate({ id: "c", source: "Meetup" }),
      ],
      client,
    );
    expect(result.groups).toEqual([[0, 1, 2]]);
  });
});
