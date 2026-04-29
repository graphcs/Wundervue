import { afterEach, describe, expect, it, vi } from "vitest";
import { probeImage } from "../imageProbe";

function makeFetchResponse(bytes: Uint8Array, contentType = "image/png", status = 200): Response {
  return new Response(bytes, {
    status,
    headers: { "content-type": contentType },
  });
}

// Padded to 16KB so the probe's MIN_BYTES (15KB) guard doesn't reject these
// fixtures. Real PNGs at any reasonable resolution are well above this.
const FIXTURE_BYTES = 16 * 1024;

// Minimal valid PNG: signature + IHDR with width/height, then zero-padded so
// the buffer clears the MIN_BYTES floor. We only parse the first 24 bytes for
// dimensions, so the trailing zeros are inert.
function pngHeader(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(FIXTURE_BYTES);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR length + type don't matter for parsing; just fill bytes 8..16.
  buf.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  // width @16, height @20, big-endian uint32
  buf[16] = (width >>> 24) & 0xff;
  buf[17] = (width >>> 16) & 0xff;
  buf[18] = (width >>> 8) & 0xff;
  buf[19] = width & 0xff;
  buf[20] = (height >>> 24) & 0xff;
  buf[21] = (height >>> 16) & 0xff;
  buf[22] = (height >>> 8) & 0xff;
  buf[23] = height & 0xff;
  return buf;
}

// JPEG with a single SOF0 marker. SOI (FFD8) + SOF0 (FFC0) + segLen (00 11) +
// precision (08) + height (2 bytes BE) + width (2 bytes BE), padded to clear
// MIN_BYTES.
function jpegHeader(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(FIXTURE_BYTES);
  buf[0] = 0xff; buf[1] = 0xd8;             // SOI
  buf[2] = 0xff; buf[3] = 0xc0;             // SOF0
  buf[4] = 0x00; buf[5] = 0x11;             // segment length
  buf[6] = 0x08;                            // precision
  buf[7] = (height >>> 8) & 0xff; buf[8] = height & 0xff;
  buf[9] = (width >>> 8) & 0xff;  buf[10] = width & 0xff;
  return buf;
}

describe("probeImage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts a properly sized PNG", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeFetchResponse(pngHeader(1200, 800))),
    );
    const result = await probeImage("https://example.com/x.png");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(1200);
      expect(result.height).toBe(800);
      expect(result.ext).toBe("png");
    }
  });

  it("rejects images below the dimension floor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeFetchResponse(pngHeader(150, 150))),
    );
    const result = await probeImage("https://example.com/thumb.png");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too small/);
  });

  it("rejects portrait aspect ratios that crop badly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeFetchResponse(pngHeader(800, 1600))),
    );
    const result = await probeImage("https://example.com/portrait.png");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/aspect/);
  });

  it("parses JPEG dimensions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeFetchResponse(jpegHeader(1600, 900), "image/jpeg")),
    );
    const result = await probeImage("https://example.com/x.jpg");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
      expect(result.ext).toBe("jpg");
    }
  });

  it("rejects responses that aren't images", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>not found</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const result = await probeImage("https://example.com/oops");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not an image/);
  });

  it("rejects HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
    );
    const result = await probeImage("https://example.com/missing.jpg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/http 404/);
  });

  it("rejects Google Maps URLs upfront without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await probeImage(
      "https://www.google.com/maps/vt/data=DgGn4y_-W3eoMj5ApOmdJ",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/blocked/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects payloads below the minimum byte floor", async () => {
    // Valid PNG header at proper dimensions, but only 4KB total — well under
    // the 15KB MIN_BYTES guard. Catches tracking pixels and lazy-load
    // placeholders that report large pixel dimensions in tiny payloads.
    const buf = new Uint8Array(4 * 1024);
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    buf.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
    // 1200x800, big-endian uint32 at offsets 16/20.
    buf[16] = 0; buf[17] = 0; buf[18] = 0x04; buf[19] = 0xb0;
    buf[20] = 0; buf[21] = 0; buf[22] = 0x03; buf[23] = 0x20;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(buf)));
    const result = await probeImage("https://example.com/tiny.png");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too small payload/);
  });

  it("rejects maps.googleapis.com static-map URLs", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await probeImage(
      "https://maps.googleapis.com/maps/api/staticmap?center=Denver&zoom=14",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/blocked/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
