import { ApifyClient } from "apify-client";
import type Anthropic from "@anthropic-ai/sdk";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { fetchImageBlock, visionExtractEvents, eventsToRawItems } from "./flyerImage";

// Vision connector for Instagram accounts whose events live in the post IMAGES
// (flyers, a season-lineup graphic) rather than the caption — e.g. The Courtyard
// (thecourtyard303), whose "Summer Concert Series" flyer lists ~28 dated shows a
// caption never spells out. We pull the account's posts via the same Apify
// instagram-scraper the caption connector uses, then send each post's image(s)
// to the vision model (reusing flyerImage's helpers) and read every event off
// them. The post timestamp anchors relative dates ("tonight"); the caption rides
// along as extra context. Each extracted event becomes a RawItem the normal
// normalize() pipeline then structures.
//
// Contrast with the plain `instagram` connector, which reads ONLY the caption
// and drops captionless posts — exactly the flyer posts that matter here.

interface ApifyInstagramPost {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  displayUrl?: string;
  images?: string[];
  timestamp?: string;
}

const ACTOR_ID = "apify/instagram-scraper";
const MAX_POSTS = 30;
// Sidecar posts carry several images (flyer + photos); a couple is enough to
// catch the flyer without ballooning the vision payload.
const MAX_IMAGES_PER_POST = 3;
const MAX_CAPTION_CHARS = 1500;

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function fetchInstagramVision(source: SourceConfig): Promise<RawItem[]> {
  const handles = asArray(source.handle);
  if (handles.length === 0) throw new Error(`source ${source.id} missing handle`);
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const client = new ApifyClient({ token });

  const directUrls = handles.map((h) => `https://www.instagram.com/${h}/`);
  const run = await withRetry(() =>
    client.actor(ACTOR_ID).call(
      {
        directUrls,
        resultsType: "posts",
        resultsLimit: MAX_POSTS * directUrls.length,
        addParentData: false,
      },
      { timeout: 300 },
    ),
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const posts = items as ApifyInstagramPost[];

  const seenPost = new Set<string>();
  const seenEvent = new Set<string>();
  const out: RawItem[] = [];

  for (const p of posts) {
    const code = p.shortCode ?? p.id;
    if (!code || seenPost.has(code)) continue;
    seenPost.add(code);

    const imageUrls = [p.displayUrl, ...(p.images ?? [])]
      .filter((u): u is string => Boolean(u))
      .filter((u, i, a) => a.indexOf(u) === i)
      .slice(0, MAX_IMAGES_PER_POST);
    const blocks = (await Promise.all(imageUrls.map(fetchImageBlock))).filter(
      (b): b is Anthropic.ImageBlockParam => b !== null,
    );
    if (blocks.length === 0) continue;

    const postUrl = p.url ?? `https://www.instagram.com/p/${code}/`;
    const postDate = p.timestamp ?? new Date().toISOString();
    const caption = (p.caption ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CAPTION_CHARS);

    const events = await visionExtractEvents(blocks, {
      referenceDate: postDate.slice(0, 10),
      contextText: caption ? `Accompanying Instagram caption: ${caption}` : undefined,
    });
    const rawItems = eventsToRawItems(events, source, postUrl, postDate);

    // A single-event post → use the post image as the listing's art. A
    // multi-event flyer (e.g. the season lineup) → leave imageUrl unset so the
    // image pipeline gives each show its own art instead of 28 copies of the
    // same schedule graphic.
    const postImage = rawItems.length === 1 ? p.displayUrl : undefined;

    for (const r of rawItems) {
      if (seenEvent.has(r.sourceId)) continue;
      seenEvent.add(r.sourceId);
      out.push(postImage ? { ...r, imageUrl: postImage } : r);
      if (source.maxItems && out.length >= source.maxItems) return out;
    }
  }

  return out;
}
