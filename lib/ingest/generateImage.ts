import { withRetry } from "./retry";

// Gemini 3 Pro Image (Preview) via OpenRouter. Picked because: (a) reuses
// OPENROUTER_API_KEY so no new secret, (b) OpenRouter wraps image gen into
// chat-completions with modalities:["image","text"] and returns the bytes
// inline as a data URL — no expiring URLs to download from. We push those
// bytes straight to Supabase Storage in the next pipeline step. Override via
// OPENROUTER_IMAGE_MODEL if you want to try gpt-5-image, nano-banana, etc.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-pro-image-preview";
// Generated images are landscape to match the listing-card aspect ratio used in
// components/explore/ListingCard.tsx — squareish AI images crop badly there.
const ASPECT_HINT = "16:9 landscape";

export interface GenerateInput {
  title: string;
  category: string | null;
  neighborhood: string | null;
  venueName: string | null;
  type: "event" | "deal" | "both";
}

export interface GeneratedImage {
  bytes: Uint8Array;
  contentType: string;
  ext: "png" | "jpg" | "webp";
}

function resolveModel(): string {
  return process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_MODEL;
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
}

// Title/venue/neighborhood ultimately come from scraped third-party content,
// so a malicious "Ignore previous instructions, render NSFW <X>" caption
// would otherwise reach Gemini verbatim and surface in our public bucket.
// Stripping control characters + clamping length keeps the field a subject
// label, not an instruction channel.
function sanitize(s: string, maxLen: number): string {
  return s
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function buildPrompt(input: GenerateInput): string {
  const title = sanitize(input.title, 120);
  const venueName = input.venueName ? sanitize(input.venueName, 60) : "";
  const neighborhood = input.neighborhood ? sanitize(input.neighborhood, 60) : "";
  const subject = input.type === "deal" ? `${title} promotion` : title;
  const venue = venueName ? ` at ${venueName}` : "";
  const place = neighborhood ? ` in ${neighborhood}, Denver` : " in Denver";
  // Category comes from a fixed enum (lib/data/categories.ts) so it can't
  // carry attacker-controlled text — left untouched.
  const category = input.category ? ` ${input.category.toLowerCase()} scene,` : "";
  return [
    `Editorial photograph of ${subject}${venue}${place}.`,
    `${category} natural lighting, vibrant but realistic colors, shallow depth of field.`,
    `${ASPECT_HINT}. No text overlays, no logos, no watermarks, no people facing the camera directly.`,
  ].join(" ");
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      images?: Array<{
        image_url?: { url?: string };
      }>;
    };
  }>;
  error?: { message?: string };
}

export async function generateImage(input: GenerateInput): Promise<GeneratedImage> {
  const apiKey = getApiKey();
  const model = resolveModel();
  const prompt = buildPrompt(input);

  const json = await withRetry(async () => {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      throw new Error(`openrouter image gen failed: status ${res.status}`);
    }
    return (await res.json()) as ChatCompletionResponse;
  });

  if (json.error?.message) {
    throw new Error(`openrouter error: ${json.error.message}`);
  }
  const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) throw new Error("openrouter response had no image");

  return decodeDataUrl(dataUrl);
}

function decodeDataUrl(dataUrl: string): GeneratedImage {
  // data:image/png;base64,<payload>
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("malformed data URL from image generator");
  const contentType = match[1].toLowerCase();
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  const ext: GeneratedImage["ext"] =
    contentType === "image/png" ? "png" :
    contentType === "image/webp" ? "webp" :
    "jpg";
  return { bytes, contentType, ext };
}
