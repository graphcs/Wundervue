import { describe, expect, it } from "vitest";
import { sanitizeForGeocoder } from "../geocode";

describe("sanitizeForGeocoder", () => {
  it("strips Unit/Suite/Apt fragments and the trailing ', USA'", () => {
    expect(
      sanitizeForGeocoder("900 W 1st Ave Unit 190, Denver, CO, USA"),
    ).toBe("900 W 1st Ave, Denver, CO");
    expect(sanitizeForGeocoder("123 Main St Ste 200, Boulder, CO")).toBe(
      "123 Main St, Boulder, CO",
    );
    expect(sanitizeForGeocoder("45 Oak Ave Apt 4B, Denver, CO")).toBe(
      "45 Oak Ave, Denver, CO",
    );
    expect(sanitizeForGeocoder("9 Pine Apartment 3, Denver, CO")).toBe(
      "9 Pine, Denver, CO",
    );
  });

  it("collapses runs of whitespace and normalizes commas", () => {
    expect(sanitizeForGeocoder("123  Main   St ,  Denver , CO")).toBe(
      "123 Main St, Denver, CO",
    );
  });

  it("leaves an address without unit fragments unchanged", () => {
    expect(sanitizeForGeocoder("1701 Wynkoop St, Denver, CO")).toBe(
      "1701 Wynkoop St, Denver, CO",
    );
  });

  // These pin known limitations of the current regex. If the regex is
  // tightened (e.g. require a word boundary after the keyword), update
  // these expectations.
  describe("known limitations", () => {
    it("over-strips words that start with a unit keyword", () => {
      expect(sanitizeForGeocoder("United Apartments Way, Denver, CO")).toBe(
        "Way, Denver, CO",
      );
    });

    it("does not strip '#N' when preceded by whitespace", () => {
      expect(sanitizeForGeocoder("12 Elm St #3, Denver, CO")).toBe(
        "12 Elm St #3, Denver, CO",
      );
    });
  });
});
