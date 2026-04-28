import { describe, expect, it } from "vitest";
import { parseSocialPreviewImage } from "../sourceImage";

describe("parseSocialPreviewImage", () => {
  it("extracts og:image when property comes first", () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://example.com/poster.jpg">
      </head></html>`;
    expect(parseSocialPreviewImage(html, "https://example.com/event")).toBe(
      "https://example.com/poster.jpg",
    );
  });

  it("extracts og:image when content comes first", () => {
    const html = `
      <meta content="https://cdn.example.com/big.png" property="og:image" />`;
    expect(parseSocialPreviewImage(html, "https://example.com")).toBe(
      "https://cdn.example.com/big.png",
    );
  });

  it("prefers og:image over twitter:image when both present", () => {
    const html = `
      <meta property="og:image" content="https://example.com/og.jpg">
      <meta name="twitter:image" content="https://example.com/tw.jpg">`;
    expect(parseSocialPreviewImage(html, "https://example.com")).toBe(
      "https://example.com/og.jpg",
    );
  });

  it("falls back to twitter:image when og:image is absent", () => {
    const html = `<meta name="twitter:image" content="https://example.com/tw.jpg">`;
    expect(parseSocialPreviewImage(html, "https://example.com")).toBe(
      "https://example.com/tw.jpg",
    );
  });

  it("resolves relative URLs against the page URL", () => {
    const html = `<meta property="og:image" content="/uploads/poster.jpg">`;
    expect(
      parseSocialPreviewImage(html, "https://library.example.com/events/kids-hangout"),
    ).toBe("https://library.example.com/uploads/poster.jpg");
  });

  it("returns null when no preview tag is present", () => {
    expect(parseSocialPreviewImage("<html><head></head></html>", "https://example.com")).toBeNull();
  });
});
