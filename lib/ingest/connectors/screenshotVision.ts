import { ApifyClient } from "apify-client";
import type Anthropic from "@anthropic-ai/sdk";
import type { RawItem, SourceConfig } from "../types";
import { withRetry } from "../retry";
import { visionExtractEvents, eventsToRawItems } from "./flyerImage";

// For calendars that render to an in-browser canvas with no text, feed, or
// fetchable image — e.g. Waldschänke Ciders' month grid, designed in Canva and
// embedded via a GoDaddy widget (GoDaddy iframe → Canva embed → <canvas>). The
// "Learn More" buttons are Canva element-links, not DOM anchors, so nothing is
// reachable by fetch/scrape. We load the directly-renderable graphic in a real
// browser, screenshot it (web-scraper's saveSnapshot → SNAPSHOT-SCREENSHOT in
// the run's key-value store), and vision-OCR the screenshot via the shared
// flyerImage helpers.
//
// `url` is the public events page. We DISCOVER the embedded design URL from it
// each run (descending into nested same-origin iframes) so a fresh monthly
// design is picked up automatically — screenshotting the GoDaddy page directly
// captures blank (the Canva iframe is cross-origin). Pass an explicit
// `["<public page>", "<embed url>"]` to skip discovery and screenshot a fixed
// URL instead.
const EMBED_RE = "canva\\\\.com/design|docs\\\\.google|view\\\\?embed|/embed";

async function discoverEmbedUrl(
  client: ApifyClient,
  pageUrl: string,
  waitMs: number,
): Promise<string | null> {
  // Recurse through same-origin iframes (GoDaddy widget → Canva embed) and
  // return the first renderable design URL.
  const pageFunction = `async function pageFunction(context) {
    await new Promise(function (r) { setTimeout(r, ${waitMs}); });
    var re = new RegExp("${EMBED_RE}", "i");
    function find(doc) {
      var frames = Array.prototype.slice.call(doc.querySelectorAll('iframe'));
      for (var i = 0; i < frames.length; i++) {
        var src = frames[i].getAttribute('src') || frames[i].getAttribute('data-src') || '';
        if (re.test(src)) return src;
        try { if (frames[i].contentDocument) { var n = find(frames[i].contentDocument); if (n) return n; } } catch (e) {}
      }
      return '';
    }
    return [{ embed: find(document) }];
  }`;
  const run = await withRetry(() =>
    client.actor("apify/web-scraper").call(
      { startUrls: [{ url: pageUrl }], pageFunction, injectJQuery: false, runMode: "PRODUCTION", maxRequestsPerCrawl: 1 },
      { timeout: 600 },
    ),
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const embed = (items[0] as { embed?: string } | undefined)?.embed;
  return embed && /^https?:/.test(embed) ? embed : null;
}

async function screenshot(client: ApifyClient, url: string, waitMs: number): Promise<Buffer | null> {
  const pageFunction = `async function pageFunction(context) { await new Promise(function (r) { setTimeout(r, ${waitMs}); }); await context.saveSnapshot(); return [{ ok: true }]; }`;
  const run = await withRetry(() =>
    client.actor("apify/web-scraper").call(
      { startUrls: [{ url }], pageFunction, injectJQuery: false, runMode: "PRODUCTION", maxRequestsPerCrawl: 1 },
      { timeout: 600 },
    ),
  );
  const rec = await client
    .keyValueStore(run.defaultKeyValueStoreId)
    .getRecord("SNAPSHOT-SCREENSHOT", { buffer: true });
  const bytes = rec?.value as Buffer | undefined;
  return bytes && bytes.length >= 5000 ? bytes : null;
}

export async function fetchScreenshotVision(source: SourceConfig): Promise<RawItem[]> {
  const urls = Array.isArray(source.url) ? source.url : source.url ? [source.url] : [];
  if (urls.length === 0) throw new Error(`source ${source.id} missing url`);
  const publicUrl = urls[0];

  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const client = new ApifyClient({ token });

  const waitMs = source.waitForTimeoutMs ?? 15000;
  // Explicit embed URL given → use it; else discover from the public page so a
  // new monthly design is picked up automatically.
  const shotUrl =
    urls.length > 1 ? urls[urls.length - 1] : ((await discoverEmbedUrl(client, publicUrl, waitMs)) ?? publicUrl);

  const bytes = await screenshot(client, shotUrl, waitMs);
  if (!bytes) return [];

  const image: Anthropic.ImageBlockParam = {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: Buffer.from(bytes).toString("base64") },
  };
  const events = await visionExtractEvents([image]);
  return eventsToRawItems(events, source, publicUrl, new Date().toISOString());
}
