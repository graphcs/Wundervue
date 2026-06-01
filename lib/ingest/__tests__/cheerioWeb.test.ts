import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import {
  forceCtykitLandscape,
  pickImageAttr,
  stripWpResize,
} from "../connectors/cheerioWeb";

function load(html: string) {
  const $ = cheerio.load(html);
  return $("img").first();
}

describe("pickImageAttr", () => {
  it("returns plain src when no lazy attrs are set", () => {
    const $img = load(`<img src="https://example.com/photo.jpg">`);
    expect(pickImageAttr($img)).toBe("https://example.com/photo.jpg");
  });

  it("picks the largest w-descriptor candidate from srcset", () => {
    const $img = load(
      `<img src="placeholder.jpg" srcset="small.jpg 320w, medium.jpg 800w, big.jpg 1600w">`,
    );
    expect(pickImageAttr($img)).toBe("big.jpg");
  });

  it("falls back to largest x-descriptor when srcset has no w descriptors", () => {
    const $img = load(`<img srcset="low.jpg 1x, mid.jpg 2x, hi.jpg 3x">`);
    expect(pickImageAttr($img)).toBe("hi.jpg");
  });

  it("returns first srcset entry when neither w nor x descriptors are present", () => {
    const $img = load(`<img srcset="first.jpg, second.jpg">`);
    expect(pickImageAttr($img)).toBe("first.jpg");
  });

  it("prefers srcset over data-src", () => {
    const $img = load(
      `<img src="placeholder.jpg" data-src="lazy.jpg" srcset="real.jpg 1200w">`,
    );
    expect(pickImageAttr($img)).toBe("real.jpg");
  });

  it("uses data-src when srcset is missing", () => {
    const $img = load(`<img src="placeholder.jpg" data-src="lazy.jpg">`);
    expect(pickImageAttr($img)).toBe("lazy.jpg");
  });

  it("falls through data-src → data-lazy-src → data-original", () => {
    const $img = load(`<img data-original="orig.jpg">`);
    expect(pickImageAttr($img)).toBe("orig.jpg");
    const $img2 = load(`<img data-lazy-src="lazy.jpg" data-original="orig.jpg">`);
    expect(pickImageAttr($img2)).toBe("lazy.jpg");
  });

  it("skips data: URI placeholders in src", () => {
    const $img = load(
      `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="real.jpg">`,
    );
    expect(pickImageAttr($img)).toBe("real.jpg");
  });

  it("skips empty src and falls through to data-src", () => {
    const $img = load(`<img src="" data-src="real.jpg">`);
    expect(pickImageAttr($img)).toBe("real.jpg");
  });

  it("returns undefined when no usable attributes are set", () => {
    const $img = load(`<img src="data:image/gif;base64,abc" alt="">`);
    expect(pickImageAttr($img)).toBeUndefined();
  });

  it("ignores data: entries inside srcset candidates", () => {
    const $img = load(
      `<img srcset="data:image/gif;base64,abc 1x, real.jpg 2x">`,
    );
    expect(pickImageAttr($img)).toBe("real.jpg");
  });
});

describe("stripWpResize", () => {
  it("strips the -WxH suffix from a resized WordPress upload", () => {
    expect(stripWpResize("https://x.com/wp-content/uploads/2026/04/photo-500x500.jpg")).toBe(
      "https://x.com/wp-content/uploads/2026/04/photo.jpg",
    );
  });

  it("preserves query strings after stripping the suffix", () => {
    expect(stripWpResize("https://x.com/photo-1024x768.jpg?ver=2")).toBe(
      "https://x.com/photo.jpg?ver=2",
    );
  });

  it("leaves URLs without the resize pattern untouched", () => {
    const url = "https://x.com/wp-content/uploads/2026/04/photo.jpg";
    expect(stripWpResize(url)).toBe(url);
  });

  it("does not strip a -WxH that lacks a recognised image extension", () => {
    // "-1x1.png" looks like a resize suffix but "-1x1.html" does not.
    const url = "https://x.com/asset-100x100.html";
    expect(stripWpResize(url)).toBe(url);
  });
});

describe("forceCtykitLandscape", () => {
  it("rewrites the tr: transform segment on a CityKit URL", () => {
    expect(
      forceCtykitLandscape(
        "https://img.ctykit.com/tr:w-900,h-900,fo-auto/sites/rino/photo.jpg",
      ),
    ).toBe(
      "https://img.ctykit.com/tr:w-1200,h-800,fo-auto/sites/rino/photo.jpg",
    );
  });

  it("leaves non-CityKit hosts untouched", () => {
    const url = "https://example.com/tr:w-900,h-900/photo.jpg";
    expect(forceCtykitLandscape(url)).toBe(url);
  });

  it("does not match URLs that merely contain 'img.ctykit.com' as a substring", () => {
    // Regression guard: substring match would rewrite a query-param payload
    // that an attacker could control. The check should be hostname-anchored.
    const url = "https://attacker.example/?u=img.ctykit.com/tr:w-900,h-900/x.jpg";
    expect(forceCtykitLandscape(url)).toBe(url);
  });

  it("returns the input unchanged when URL parsing fails", () => {
    const garbage = "not a url at all";
    expect(forceCtykitLandscape(garbage)).toBe(garbage);
  });
});
