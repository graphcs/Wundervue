import { describe, expect, it } from "vitest";
import {
  buildPageHref,
  pageWindow,
  paginate,
  readPageParam,
} from "../paginate";

describe("readPageParam", () => {
  it("defaults to 1 when missing", () => {
    expect(readPageParam({})).toBe(1);
  });

  it("parses a positive integer string", () => {
    expect(readPageParam({ page: "3" })).toBe(3);
  });

  it("uses the first entry when given an array", () => {
    expect(readPageParam({ page: ["4", "9"] })).toBe(4);
  });

  it("falls back to 1 for non-numeric or non-positive values", () => {
    expect(readPageParam({ page: "foo" })).toBe(1);
    expect(readPageParam({ page: "0" })).toBe(1);
    expect(readPageParam({ page: "-2" })).toBe(1);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it("returns the requested page slice", () => {
    const r = paginate(items, { page: "2" }, 9);
    expect(r.page).toBe(2);
    expect(r.totalPages).toBe(3);
    expect(r.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("clamps page above totalPages back to the last page", () => {
    const r = paginate(items, { page: "99" }, 9);
    expect(r.page).toBe(3);
    expect(r.items).toEqual([19, 20, 21, 22, 23]);
  });

  it("returns totalPages=1 for an empty list", () => {
    const r = paginate([], { page: "1" }, 9);
    expect(r.page).toBe(1);
    expect(r.totalPages).toBe(1);
    expect(r.items).toEqual([]);
  });
});

describe("buildPageHref", () => {
  it("omits the page param for page 1", () => {
    expect(buildPageHref("/explore", {}, 1)).toBe("/explore");
  });

  it("sets the page param for pages >1", () => {
    expect(buildPageHref("/explore", {}, 3)).toBe("/explore?page=3");
  });

  it("preserves other search params and drops any incoming page", () => {
    const href = buildPageHref(
      "/explore",
      { type: "music", page: "5" },
      2,
    );
    expect(href).toBe("/explore?type=music&page=2");
  });

  it("appends each value in array params", () => {
    expect(buildPageHref("/explore", { hood: ["lodo", "rino"] }, 1)).toBe(
      "/explore?hood=lodo&hood=rino",
    );
  });
});

describe("pageWindow", () => {
  it("returns every page when total is small", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("inserts a leading ellipsis when current is near the last page", () => {
    expect(pageWindow(9, 10)).toEqual([1, "…", 8, 9, 10]);
  });

  it("inserts a trailing ellipsis when current is near page 1", () => {
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, "…", 10]);
  });

  it("inserts both ellipses when current is in the middle", () => {
    expect(pageWindow(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
  });
});
