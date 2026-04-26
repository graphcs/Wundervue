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

export async function fetchInstagram(source: SourceConfig): Promise<RawItem[]> {
  if (!source.handle) {
    throw new Error(`source ${source.id} missing handle`);
  }
  const client = getClient();

  const run = await withRetry(() =>
    client.actor(ACTOR_ID).call(
      {
        directUrls: [`https://www.instagram.com/${source.handle}/`],
        resultsType: "posts",
        resultsLimit: MAX_POSTS,
        addParentData: false,
      },
      { timeout: 300 }, // seconds; aligns with Vercel Pro function timeout
    ),
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const posts = items as ApifyInstagramPost[];

  return posts
    .filter((p) => p.caption && (p.shortCode || p.id))
    .map((p): RawItem => ({
      sourceId: p.shortCode ?? p.id!,
      sourceUrl: p.url ?? `https://www.instagram.com/p/${p.shortCode}/`,
      text: p.caption!,
      imageUrl: p.displayUrl,
      fetchedAt: p.timestamp ?? new Date().toISOString(),
    }));
}
