import { describe, expect, it } from "vitest";
import { parseSearchParams } from "../parseSearchParams";
import { DEFAULT_PAGE_SIZE } from "../types";

describe("parseSearchParams — sort", () => {
  it("round-trips every valid sort id", () => {
    for (const s of ["soonest", "latest", "free-first", "deals-first", "most-saved"]) {
      expect(parseSearchParams({ sort: s }).sort).toBe(s);
    }
  });

  it("falls back to soonest for unknown/missing", () => {
    expect(parseSearchParams({ sort: "bogus" }).sort).toBe("soonest");
    expect(parseSearchParams({}).sort).toBe("soonest");
  });
});

describe("parseSearchParams — pageSize", () => {
  it("defaults to DEFAULT_PAGE_SIZE", () => {
    expect(parseSearchParams({}).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("honors a valid per value and rejects others", () => {
    expect(parseSearchParams({ per: "12" }).pageSize).toBe(12);
    expect(parseSearchParams({ per: "7" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});
