import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { buildOpenRouterClient, resolveModel } from "../normalize";

// Vision connector for venues that publish their calendar only as a flyer IMAGE
// (e.g. Jungle Rum Bar's monthly "JUNGLE EVENTS" graphic — no scrapeable text,
// no feed). We fetch the page, send its content images to the vision model
// (Claude Haiku via OpenRouter — already vision-capable), and have it read each
// event off the flyer. Each extracted event becomes a RawItem whose text blob
// the normal normalize() pipeline then structures (date/recurring/venue). The
// flyer changes monthly, so re-reading the page each run keeps it current.
//
// The vision extraction (visionExtractEvents) + RawItem mapping (eventsToRawItems)
// are exported and reused by screenshotVision.ts, which feeds a page screenshot
// instead of fetched flyer URLs.
const TOOL_NAME = "record_flyer_events";
const TOOL_SCHEMA: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Record every event read from the venue flyer / calendar image(s).",
  input_schema: {
    type: "object",
    required: ["events"],
    properties: {
      events: {
        type: "array",
        description:
          "One entry per event shown on the image(s). Empty array if they contain no event listings.",
        items: {
          type: "object",
          required: ["title", "date_text", "time_text", "description"],
          properties: {
            title: { type: "string", description: "Event name as shown." },
            date_text: {
              type: "string",
              description:
                "The date EXACTLY as written — e.g. 'Tues June 2nd', 'June 13', 'Every Wednesday'. Include the month/year context shown on the image.",
            },
            time_text: { type: "string", description: "Time as shown, e.g. '6:30PM'. Empty if none." },
            description: { type: "string", description: "Short description if any, else empty." },
          },
        },
      },
    },
  },
};

export interface FlyerEvent {
  title?: string;
  date_text?: string;
  time_text?: string;
  description?: string;
}

const IMG_RE = /(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpe?g|png|webp)(?:\?[^"]*)?)"/gi;
const SKIP_IMG = /logo|icon|favicon|avatar|sprite|badge|header|footer/i;

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function collectImages(html: string, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(IMG_RE)) {
    const url = m[1];
    const base = url.split("?")[0];
    if (seen.has(base) || SKIP_IMG.test(url)) continue;
    seen.add(base);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

async function fetchImageBlock(url: string): Promise<Anthropic.ImageBlockParam | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.startsWith("image/")) return null;
    const media_type: MediaType = ct.includes("png")
      ? "image/png"
      : ct.includes("webp")
        ? "image/webp"
        : ct.includes("gif")
          ? "image/gif"
          : "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    // Skip tiny (logos slipped through) and oversized payloads.
    if (buf.byteLength < 2048 || buf.byteLength > 5 * 1024 * 1024) return null;
    return { type: "image", source: { type: "base64", media_type, data: buf.toString("base64") } };
  } catch {
    return null;
  }
}

// Send images to the vision model and read back the events it sees. Shared by
// the flyer-URL path (this file) and the screenshot path (screenshotVision.ts).
export async function visionExtractEvents(images: Anthropic.ImageBlockParam[]): Promise<FlyerEvent[]> {
  if (images.length === 0) return [];
  const anthropic = buildOpenRouterClient();
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text:
        "These are images from a venue's website — event flyers or a calendar graphic. " +
        "Read EVERY event shown and record each one. Copy date_text verbatim as written (including the month/year shown). " +
        "Ignore non-event images, logos, and photos. If no events appear, return an empty array.",
    },
    ...images,
  ];
  const response: Anthropic.Message = await withRetry(() =>
    anthropic.messages.create({
      model: resolveModel(),
      max_tokens: 2048,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: TOOL_NAME },
      system:
        "You extract event listings from venue flyer / calendar images into structured JSON. Only report events actually shown on the images; never invent events.",
      messages: [{ role: "user", content }],
    }),
  );
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  return block ? ((block.input as { events?: FlyerEvent[] }).events ?? []) : [];
}

// Map vision-extracted events to RawItems (one per event) for the normalize
// pipeline. Dedupes on title+date.
export function eventsToRawItems(
  events: FlyerEvent[],
  source: SourceConfig,
  sourceUrl: string,
  fetchedAt: string,
): RawItem[] {
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const e of events) {
    const title = (e.title ?? "").trim();
    if (!title) continue;
    const dateText = (e.date_text ?? "").trim();
    const when = [dateText, (e.time_text ?? "").trim()].filter(Boolean).join(" ");
    const sourceId = `${source.id}:${createHash("sha1").update(`${title}|${dateText}`).digest("hex").slice(0, 16)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const text = [
      title,
      when ? `Date: ${when}` : "",
      source.defaultVenueName ? `Venue: ${source.defaultVenueName}` : "",
      (e.description ?? "").trim(),
    ]
      .filter(Boolean)
      .join("\n");
    out.push({ sourceId, sourceUrl, text, fetchedAt, venueName: source.defaultVenueName });
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}

export async function fetchFlyerImage(source: SourceConfig): Promise<RawItem[]> {
  const pageUrl = Array.isArray(source.url) ? source.url[0] : source.url;
  if (!pageUrl) throw new Error(`source ${source.id} missing url`);

  const html = await withRetry(async () => {
    const res = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`flyer page ${res.status}`);
    return res.text();
  });

  const urls = collectImages(html, source.maxImages ?? 6);
  const images = (await Promise.all(urls.map(fetchImageBlock))).filter(
    (b): b is Anthropic.ImageBlockParam => b !== null,
  );
  const events = await visionExtractEvents(images);
  return eventsToRawItems(events, source, pageUrl, new Date().toISOString());
}
