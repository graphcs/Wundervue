import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES } from "@/lib/data/categories";
import { ONBOARDING_NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { withRetry } from "./retry";
import type { NormalizedListing, RawItem, SourceConfig } from "./types";

const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
// The Anthropic SDK appends `/v1/messages` to the baseURL, so we set the host
// without the `/v1` segment — otherwise OpenRouter sees `/v1/v1/messages` → 404.
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
const TOOL_NAME = "record_listing";

export function resolveModel(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

export function buildOpenRouterClient(): Anthropic {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new Anthropic({ apiKey, baseURL: OPENROUTER_BASE_URL });
}

const ALLOWED_CATEGORIES = CATEGORIES.map((c) => c.label);
const ALLOWED_NEIGHBORHOODS = ONBOARDING_NEIGHBORHOODS;

const TOOL_SCHEMA: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Record a normalized event or deal extracted from raw social/web content. Set is_event_or_deal=false to discard non-event content.",
  input_schema: {
    type: "object",
    required: [
      "is_event_or_deal",
      "type",
      "title",
      "canonical_title",
      "description",
      "category",
      "neighborhood",
      "date_start",
      "date_end",
      "date_display",
      "time_display",
      "is_free",
      "deal_value",
      "tags",
    ],
    properties: {
      is_event_or_deal: {
        type: "boolean",
        description: "True if this content describes a discoverable event or deal at a specific venue. False for promotional fluff, memes, etc.",
      },
      type: { type: "string", enum: ["event", "deal", "both"] },
      title: { type: "string", description: "Short human-readable title (under 80 chars)." },
      canonical_title: {
        type: "string",
        description: "Lowercased title with articles (a, an, the) and punctuation removed. Used for cross-source dedup.",
      },
      description: {
        type: "string",
        description: "1-2 sentence description suitable for a card. No emoji.",
      },
      category: {
        type: "string",
        enum: ALLOWED_CATEGORIES,
        description: "Best-fit category label from the allowed list.",
      },
      neighborhood: {
        type: "string",
        enum: ALLOWED_NEIGHBORHOODS,
        description: "Best-fit Denver neighborhood. If unknown, use the source's default neighborhood (which will be passed in the prompt as a hint).",
      },
      date_start: {
        type: ["string", "null"],
        description: "ISO 8601 timestamp. Null if no date can be inferred. Resolve relative dates (\"tonight\", \"this Friday\") against the provided current_date.",
      },
      date_end: { type: ["string", "null"], description: "ISO 8601 timestamp or null." },
      date_display: { type: "string", description: 'Human-readable date label, e.g. "Sat, Apr 12" or "Every Friday".' },
      time_display: { type: "string", description: 'Human-readable time, e.g. "8:00 PM". Empty string if not stated.' },
      is_free: { type: "boolean" },
      deal_value: {
        type: ["string", "null"],
        description: 'For deals: "BOGO", "20% Off", "$5 Beers", etc. Null for non-deals.',
      },
      tags: {
        type: "array",
        items: {
          type: "string",
          enum: ["date-night", "dog-friendly", "family", "outdoor"],
        },
      },
    },
  },
};

interface NormalizeArgs {
  item: RawItem;
  source: SourceConfig;
  currentDate?: string;
  client?: Anthropic;
}

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  cachedClient = buildOpenRouterClient();
  return cachedClient;
}

export async function normalize({
  item,
  source,
  currentDate = new Date().toISOString().slice(0, 10),
  client,
}: NormalizeArgs): Promise<NormalizedListing | null> {
  const anthropic = client ?? getClient();

  const userPrompt = [
    `Source: ${source.sourceLabel} (${source.id})`,
    `Source URL: ${item.sourceUrl ?? "(none)"}`,
    `Current date: ${currentDate}`,
    source.defaultCategory ? `Default category hint: ${source.defaultCategory}` : "",
    source.defaultVenueSlug ? `Default venue: ${source.defaultVenueSlug}` : "",
    "",
    "Raw content:",
    item.text,
  ]
    .filter(Boolean)
    .join("\n");

  const response: Anthropic.Message = await withRetry(() =>
    anthropic.messages.create({
      model: resolveModel(),
      max_tokens: 1024,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: TOOL_NAME },
      system:
        "You normalize raw event/deal content from Denver venues into structured JSON. Be conservative: if it isn't a real event or deal, set is_event_or_deal=false. Resolve relative dates against current_date.",
      messages: [{ role: "user", content: userPrompt }],
    }),
  );

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolBlock) return null;

  const raw = toolBlock.input as Record<string, unknown>;
  if (!raw.is_event_or_deal) return null;

  return {
    isEventOrDeal: true,
    type: raw.type as NormalizedListing["type"],
    title: String(raw.title),
    canonicalTitle: String(raw.canonical_title),
    description: String(raw.description),
    category: String(raw.category),
    neighborhood: String(raw.neighborhood),
    dateStart: raw.date_start as string | null,
    dateEnd: raw.date_end as string | null,
    dateDisplay: String(raw.date_display ?? ""),
    timeDisplay: String(raw.time_display ?? ""),
    isFree: Boolean(raw.is_free),
    dealValue: (raw.deal_value as string | null) ?? null,
    tags: (raw.tags as NormalizedListing["tags"]) ?? [],
  };
}
