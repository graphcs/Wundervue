// Lightweight image-quality gate. Fetches the URL, reads only the magic-byte
// header to extract dimensions, and decides whether the picture is good enough
// for a listing card. Common low-quality cases we want to reject:
//
//   • Instagram thumbnails downscaled to ~150px
//   • SerpAPI returning a Google Maps screenshot or favicon
//   • og:image set to a 1×1 tracking pixel
//   • portrait-only stock images that crop badly into 16:9 cards
//
// We download the full body (rather than streaming the header) so the same
// fetch result is reused by the storage uploader — saves a second round-trip.

const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const MIN_ASPECT = 1.2; // landscape-ish: width / height
const MAX_ASPECT = 2.4; // not ultra-wide banners
// Tracking pixels and lazy-load placeholders sometimes report large pixel
// dimensions but pack into a few KB of solid color or near-empty data.
// A real photograph at 1200x800 is rarely under ~30KB even with aggressive
// WebP — 15KB is a safe floor that still admits highly-compressed JPEGs.
const MIN_BYTES = 15 * 1024;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB safety cap
const FETCH_TIMEOUT_MS = 8000;

// URL hosts/paths we always reject without fetching. SerpAPI sometimes points
// at a Google Maps tile or static-map screenshot when it can't find a real
// event photo — those are visually useless on a card and shouldn't even be
// considered candidates. Rejecting upfront also saves a network round-trip.
const URL_BLOCKLIST: Array<(u: URL) => boolean> = [
  (u) => /(^|\.)google\.com$/.test(u.hostname) && u.pathname.includes("/maps/"),
  (u) => /(^|\.)googleapis\.com$/.test(u.hostname) && u.pathname.includes("/maps/"),
  (u) => /(^|\.)gstatic\.com$/.test(u.hostname) && u.pathname.includes("/maps/"),
  (u) => /(^|\.)google\.com$/.test(u.hostname) && u.pathname.startsWith("/url"), // redirect wrappers
];

function isBlockedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  for (const test of URL_BLOCKLIST) {
    if (test(u)) return `blocked host/path: ${u.hostname}${u.pathname}`;
  }
  return null;
}

export interface ImageProbeOk {
  ok: true;
  width: number;
  height: number;
  contentType: string;
  bytes: Uint8Array;
  ext: "jpg" | "png" | "webp" | "gif";
}

export interface ImageProbeFail {
  ok: false;
  reason: string;
}

export type ImageProbeResult = ImageProbeOk | ImageProbeFail;

export async function probeImage(url: string): Promise<ImageProbeResult> {
  const blocked = isBlockedUrl(url);
  if (blocked) return { ok: false, reason: blocked };

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "WundervueImageProbe/1.0" },
    });
  } catch (err) {
    return { ok: false, reason: `fetch failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok) return { ok: false, reason: `http ${res.status}` };

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    return { ok: false, reason: `not an image: ${contentType || "(no content-type)"}` };
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) return { ok: false, reason: "empty body" };
  if (buf.byteLength > MAX_BYTES) return { ok: false, reason: `too large: ${buf.byteLength} bytes` };
  if (buf.byteLength < MIN_BYTES) return { ok: false, reason: `too small payload: ${buf.byteLength} bytes` };

  const dims = readDimensions(buf);
  if (!dims) return { ok: false, reason: "unrecognized image format" };

  if (dims.width < MIN_WIDTH || dims.height < MIN_HEIGHT) {
    return { ok: false, reason: `too small: ${dims.width}x${dims.height}` };
  }
  const aspect = dims.width / dims.height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return { ok: false, reason: `bad aspect ratio: ${aspect.toFixed(2)}` };
  }

  return {
    ok: true,
    width: dims.width,
    height: dims.height,
    contentType,
    bytes: buf,
    ext: dims.ext,
  };
}

interface Dimensions {
  width: number;
  height: number;
  ext: ImageProbeOk["ext"];
}

function readDimensions(buf: Uint8Array): Dimensions | null {
  if (buf.length < 24) return null;
  if (isPng(buf)) return readPng(buf);
  if (isJpeg(buf)) return readJpeg(buf);
  if (isWebp(buf)) return readWebp(buf);
  if (isGif(buf)) return readGif(buf);
  return null;
}

function isPng(b: Uint8Array): boolean {
  return (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  );
}

function readPng(b: Uint8Array): Dimensions | null {
  // IHDR is the first chunk; width@16, height@20 (big-endian uint32).
  if (b.length < 24) return null;
  const width = readUint32BE(b, 16);
  const height = readUint32BE(b, 20);
  if (!width || !height) return null;
  return { width, height, ext: "png" };
}

function isJpeg(b: Uint8Array): boolean {
  return b[0] === 0xff && b[1] === 0xd8;
}

function readJpeg(b: Uint8Array): Dimensions | null {
  // Walk JPEG markers looking for any SOFn (Start Of Frame) other than the
  // exclusion list, where dimensions live at offsets +5 (height) and +7 (width).
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) return null;
    let marker = b[i + 1];
    while (marker === 0xff) marker = b[++i + 1]; // skip fill bytes
    i += 2;
    // Standalone markers (no payload): SOI/EOI/RSTn/TEM
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    const segLen = readUint16BE(b, i);
    if (segLen < 2) return null;
    const isSOFn =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOFn) {
      const height = readUint16BE(b, i + 3);
      const width = readUint16BE(b, i + 5);
      if (!width || !height) return null;
      return { width, height, ext: "jpg" };
    }
    i += segLen;
  }
  return null;
}

function isWebp(b: Uint8Array): boolean {
  return (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // "RIFF"
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50    // "WEBP"
  );
}

function readWebp(b: Uint8Array): Dimensions | null {
  // VP8 (lossy), VP8L (lossless), VP8X (extended)
  const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (tag === "VP8 ") {
    if (b.length < 30) return null;
    const width = readUint16LE(b, 26) & 0x3fff;
    const height = readUint16LE(b, 28) & 0x3fff;
    return { width, height, ext: "webp" };
  }
  if (tag === "VP8L") {
    if (b.length < 25) return null;
    const w = ((b[22] & 0x3f) << 8) | b[21];
    const h = ((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6);
    return { width: w + 1, height: h + 1, ext: "webp" };
  }
  if (tag === "VP8X") {
    if (b.length < 30) return null;
    const w = b[24] | (b[25] << 8) | (b[26] << 16);
    const h = b[27] | (b[28] << 8) | (b[29] << 16);
    return { width: w + 1, height: h + 1, ext: "webp" };
  }
  return null;
}

function isGif(b: Uint8Array): boolean {
  return (
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && // "GIF8"
    (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61                    // "7a" or "9a"
  );
}

function readGif(b: Uint8Array): Dimensions | null {
  if (b.length < 10) return null;
  return { width: readUint16LE(b, 6), height: readUint16LE(b, 8), ext: "gif" };
}

function readUint16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function readUint16LE(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
function readUint32BE(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
