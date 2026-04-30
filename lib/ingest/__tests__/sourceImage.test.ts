import { afterEach, describe, expect, it, vi } from "vitest";
import { extractOgImageFromUrl, parseSocialPreviewImage } from "../sourceImage";

const MAX_RESPONSE_BYTES = 1_048_576;

function htmlResponse(body: string, contentLength?: number | null): Response {
  const headers: Record<string, string> = { "content-type": "text/html" };
  if (contentLength !== null && contentLength !== undefined) {
    headers["content-length"] = String(contentLength);
  }
  return new Response(body, { status: 200, headers });
}

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

  it("falls through to next candidate on a malformed og:image URL", () => {
    // og:image regex matches but the URL throws when constructed; should not
    // abort — try twitter:image instead so a single broken tag doesn't sink
    // the whole extraction. `http://` with no host is one of the few inputs
    // that actually throws via `new URL(input, base)` since URL relative
    // resolution is otherwise extremely permissive.
    const html = `
      <meta property="og:image" content="http://">
      <meta name="twitter:image" content="https://example.com/good.jpg">`;
    expect(parseSocialPreviewImage(html, "https://example.com")).toBe(
      "https://example.com/good.jpg",
    );
  });
});

describe("extractOgImageFromUrl byte caps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("bails before reading body when content-length exceeds cap", async () => {
    // Honest server advertises a body too large to bother with.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(htmlResponse("ignored", MAX_RESPONSE_BYTES + 1)),
    );
    expect(await extractOgImageFromUrl("https://big.example.com")).toBeNull();
  });

  it("proceeds when content-length is under the cap", async () => {
    const html = `<meta property="og:image" content="https://example.com/p.jpg">`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html, html.length)));
    expect(await extractOgImageFromUrl("https://small.example.com/page")).toBe(
      "https://example.com/p.jpg",
    );
  });

  it("falls through to streaming counter when content-length is missing", async () => {
    // No CL header → upfront guard skipped, streaming counter does the work.
    const html = `<meta property="og:image" content="https://example.com/p.jpg">`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html, null)));
    expect(await extractOgImageFromUrl("https://chunked.example.com/page")).toBe(
      "https://example.com/p.jpg",
    );
  });

  it("ignores non-finite content-length and falls through to streaming", async () => {
    // Garbage CL like "abc" parses to NaN; guard must not bail false-positive.
    const html = `<meta property="og:image" content="https://example.com/p.jpg">`;
    const res = new Response(html, {
      status: 200,
      headers: { "content-type": "text/html", "content-length": "abc" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
    expect(await extractOgImageFromUrl("https://garbage-cl.example.com")).toBe(
      "https://example.com/p.jpg",
    );
  });

  it("returns null on non-html content-type before reading body", async () => {
    const res = new Response("not html", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
    expect(await extractOgImageFromUrl("https://json.example.com")).toBeNull();
  });

  it("returns null when fetch throws (timeout / DNS / TLS / abort)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await extractOgImageFromUrl("https://broken.example.com")).toBeNull();
  });

  it("returns null on non-2xx HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not found", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    expect(await extractOgImageFromUrl("https://gone.example.com")).toBeNull();
  });
});
