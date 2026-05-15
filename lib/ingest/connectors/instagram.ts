import { ApifyClient } from "apify-client";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";

interface ApifyInstagramPost {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  displayUrl?: string;
  timestamp?: string;
}

const ACTOR_ID = "apify/instagram-scraper";
const MAX_POSTS = 30;

function getClient(): ApifyClient {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not set");
  }
  return new ApifyClient({ token });
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function fetchInstagram(source: SourceConfig): Promise<RawItem[]> {
  const handles = asArray(source.handle);
  const hashtags = asArray(source.hashtag);
  if (handles.length === 0 && hashtags.length === 0) {
    throw new Error(`source ${source.id} missing handle or hashtag`);
  }
  const client = getClient();
  // Apify's Instagram scraper accepts a list of directUrls and fans out
  // across them in one run. Mixing accounts and tags in the same array is
  // supported — it returns a flat list of posts.
  const directUrls = [
    ...handles.map((h) => `https://www.instagram.com/${h}/`),
    ...hashtags.map((t) => `https://www.instagram.com/explore/tags/${t}/`),
  ];

  // Cap total posts so a 4-hashtag source doesn't overshoot quota. MAX_POSTS
  // is the per-URL hint that Apify applies; the actor's resultsLimit is the
  // total cap across all directUrls. Honor source.maxItems when set —
  // observed in practice that Apify's resultsLimit isn't always respected
  // (a previous 180-cap run returned 539), so we also slice the output
  // below as a hard ceiling on what the downstream LLM/image pipeline has
  // to chew through.
  const requestedLimit = source.maxItems ?? MAX_POSTS * directUrls.length;

  const run = await withRetry(() =>
    client.actor(ACTOR_ID).call(
      {
        directUrls,
        resultsType: "posts",
        resultsLimit: requestedLimit,
        addParentData: false,
      },
      { timeout: 300 }, // seconds; aligns with Vercel Pro function timeout
    ),
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const posts = items as ApifyInstagramPost[];

  // Multi-hashtag fan-out can return the same post under several tags —
  // dedupe by shortCode/id before handing off, otherwise the persist
  // upsert hits "ON CONFLICT DO UPDATE command cannot affect row a second
  // time" on (source, source_id).
  const seen = new Set<string>();
  const out: RawItem[] = [];
  const hardCap = source.maxItems;
  for (const p of posts) {
    if (hardCap !== undefined && out.length >= hardCap) break;
    if (!p.caption || (!p.shortCode && !p.id)) continue;
    const sourceId = p.shortCode ?? p.id!;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    out.push({
      sourceId,
      sourceUrl: p.url ?? `https://www.instagram.com/p/${p.shortCode}/`,
      text: p.caption,
      imageUrl: p.displayUrl,
      fetchedAt: p.timestamp ?? new Date().toISOString(),
    });
  }
  return out;
}
