import { describe, expect, it } from "vitest";
import { rowToPage } from "../landingPages";

// A representative DB row (SELECT always returns every column; unset ones are null).
const row = {
  slug: "denver-this-weekend",
  title: "Things to Do in Denver This Weekend",
  meta_title: "Things to Do in Denver This Weekend | Wundervue",
  meta_description: "The best events this weekend.",
  og_image: null,
  above_html: "<h1>This Weekend</h1>",
  below_html: "<p>Plan your weekend</p>",
  filter_config: { date: "this-weekend", type: "events" },
};

describe("rowToPage", () => {
  it("maps snake_case columns to the LandingPage shape", () => {
    const p = rowToPage(row);
    expect(p.slug).toBe("denver-this-weekend");
    expect(p.title).toBe("Things to Do in Denver This Weekend");
    expect(p.metaTitle).toBe("Things to Do in Denver This Weekend | Wundervue");
    expect(p.metaDescription).toBe("The best events this weekend.");
    expect(p.aboveHtml).toBe("<h1>This Weekend</h1>");
    expect(p.belowHtml).toBe("<p>Plan your weekend</p>");
  });

  it("keeps null meta fields null", () => {
    const p = rowToPage(row);
    expect(p.ogImage).toBeNull();
  });

  it("applies a valid filter_config through parseSearchParams", () => {
    const p = rowToPage(row);
    expect(p.filterConfig.date).toBe("this-weekend");
    expect(p.filterConfig.type).toBe("events");
  });

  it("normalizes JSON array + boolean filter_config values for the parser", () => {
    const p = rowToPage({ ...row, filter_config: { lifestyle: ["dog-friendly", "outdoor"], free: true } });
    expect(p.filterConfig.lifestyle).toEqual(["dog-friendly", "outdoor"]); // array → CSV → parsed
    expect(p.filterConfig.freeOnly).toBe(true); // boolean → "1"
  });

  it("drops typo'd keys and invalid values, falling back to defaults", () => {
    const p = rowToPage({ ...row, filter_config: { tyype: "events", date: "someday" } });
    expect(p.filterConfig.type).toBe("all"); // unknown key ignored
    expect(p.filterConfig.date).toBe("any"); // invalid value rejected
  });

  it("defaults an empty filter_config to a full Filters object", () => {
    const p = rowToPage({ ...row, filter_config: {} });
    expect(p.filterConfig.type).toBe("all");
    expect(p.filterConfig.date).toBe("any");
    expect(p.filterConfig.view).toBe("grid");
  });

  it("defaults missing html columns to empty strings", () => {
    const p = rowToPage({ slug: "x", title: "X", filter_config: {} });
    expect(p.aboveHtml).toBe("");
    expect(p.belowHtml).toBe("");
  });
});
