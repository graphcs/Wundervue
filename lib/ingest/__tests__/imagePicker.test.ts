import { describe, expect, it } from "vitest";
import { IMAGE_PICKER_SOURCE } from "../connectors/imagePicker";

// IMAGE_PICKER_SOURCE is concatenated function source that gets injected into
// Apify's worker pageFunction. The Apify worker calls these helpers by name,
// so the toString() output must (a) keep the canonical names visible to the
// worker, and (b) parse as plain JS once TypeScript annotations are erased.
// A bundler that mangles names or a TS-only construct that survives erasure
// would break Apify silently — these tests catch both before deploy.
describe("IMAGE_PICKER_SOURCE", () => {
  it("contains each helper as a recognizable function declaration", () => {
    expect(IMAGE_PICKER_SOURCE).toMatch(/function\s+isUsableUrl\b/);
    expect(IMAGE_PICKER_SOURCE).toMatch(/function\s+pickFromSrcset\b/);
    expect(IMAGE_PICKER_SOURCE).toMatch(/function\s+pickImageAttr\b/);
  });

  it("parses as valid JS via the Function constructor", () => {
    // If `as const` or another TS-only construct slipped through compilation,
    // this would throw a SyntaxError. Arrow conversion or minification rename
    // would still parse — we test name preservation separately above.
    expect(() => new Function(`${IMAGE_PICKER_SOURCE}; return pickImageAttr;`)).not.toThrow();
  });

  it("produces helpers that work end-to-end via Function eval (mirrors Apify worker)", () => {
    // Build a fake `$el` matching the cheerio attr() interface and confirm
    // pickImageAttr resolves from src — exercises the inter-function calls
    // (pickImageAttr → pickFromSrcset → isUsableUrl) the same way Apify will.
    const factory = new Function(
      "$el",
      `${IMAGE_PICKER_SOURCE}; return pickImageAttr($el);`,
    );
    const $el = {
      attr: (name: string) =>
        ({ srcset: undefined, "data-src": undefined, src: "https://example.com/x.jpg" } as Record<
          string,
          string | undefined
        >)[name],
    };
    expect(factory($el)).toBe("https://example.com/x.jpg");
  });
});
