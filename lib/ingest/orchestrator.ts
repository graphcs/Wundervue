import type { IngestResult, ListingInsert, RawItem, SourceConfig } from "./types";
import { fetchInstagram } from "./connectors/instagram";
import { fetchSerpEvents } from "./connectors/serpEvents";
import { fetchApifyWeb } from "./connectors/apifyWeb";
import { fetchCheerioWeb } from "./connectors/cheerioWeb";
import { fetchJsonLdEvents } from "./connectors/jsonLdEvents";
import { normalize } from "./normalize";
import { checkUrl } from "./checkUrl";
import { clusterAndMarkDuplicates } from "./dedupCluster";
import { resolveListingImage } from "./imagePipeline";
import {
  applyBatch,
  buildListingInsert,
  classifyForUpsert,
  finishRun,
  recentFailureStreak,
  resolveOrCreateVenue,
  startRun,
  writeFailedRunSentinel,
  type VenueRow,
} from "./persist";

const MAX_FAILURE_STREAK = 3;

async function fetchRaw(source: SourceConfig): Promise<RawItem[]> {
  switch (source.connector) {
    case "instagram":
      return fetchInstagram(source);
    case "serpEvents":
      return fetchSerpEvents(source);
    case "apifyWeb":
      return fetchApifyWeb(source);
    case "cheerioWeb":
      return fetchCheerioWeb(source);
    case "jsonLdEvents":
      return fetchJsonLdEvents(source);
  }
}

export async function ingestSource(source: SourceConfig): Promise<IngestResult> {
  if (!source.enabled) {
    return {
      sourceId: source.id,
      status: "skipped",
      itemsSeen: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsDuplicate: 0,
      error: "disabled",
    };
  }

  const streak = await recentFailureStreak(source.id);
  if (streak >= MAX_FAILURE_STREAK) {
    return {
      sourceId: source.id,
      status: "skipped",
      itemsSeen: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsDuplicate: 0,
      error: `auto-disabled after ${streak} consecutive failures`,
    };
  }

  const runId = await startRun(source.id, streak + 1);

  try {
    const rawItems = await fetchRaw(source);

    // Skip items whose sourceUrl is definitively dead (404/410/DNS).
    // Cheaper than an LLM normalize call, so do it first.
    const liveItems = await filterLiveUrls(rawItems, source.id);

    const normalized = await Promise.all(
      liveItems.map(async (item) => {
        try {
          const result = await normalize({ item, source });
          return result ? { item, result } : null;
        } catch (err) {
          console.error(`[ingest:${source.id}] normalize failed for ${item.sourceId}`, err);
          return null;
        }
      }),
    );

    // Resolve a venue per item. Sequential because the geocoder rate-limits
    // (1 req/sec public Nominatim quota) — parallelising would just queue
    // anyway, and within-run caching collapses repeat venues to one call.
    const pairs: Array<{
      row: ListingInsert;
      venue: VenueRow | null;
    }> = [];
    for (const n of normalized) {
      if (!n) continue;
      const venue = await resolveOrCreateVenue({
        defaultVenueSlug: source.defaultVenueSlug,
        venueName: n.result.venueName,
        address: n.result.address,
        neighborhood: n.result.neighborhood,
      });
      pairs.push({
        row: buildListingInsert({ source, item: n.item, normalized: n.result, venue }),
        venue,
      });
    }

    // Resolve a permanent image for each row before persistence: probe the
    // scraped URL, fall back to AI generation, mirror to Supabase Storage.
    // Drop the row entirely if we can't produce an image — better than
    // showing a broken card or a low-quality thumbnail.
    const withImages = await resolveImagesForBatch(pairs, source.id);

    const actions = await classifyForUpsert(withImages);
    const counts = await applyBatch(actions);

    // LLM fuzzy-cluster pass: catches paraphrased duplicates the hash misses.
    // Failures here don't fail the whole run — the deterministic dedup already
    // handled exact matches and bad clusters can be cleaned up reactively.
    let fuzzyMarked = 0;
    try {
      const cluster = await clusterAndMarkDuplicates(source.sourceLabel);
      fuzzyMarked = cluster.markedDuplicate;
    } catch (err) {
      console.error(`[ingest:${source.id}] cluster pass failed`, err);
    }

    const result: IngestResult = {
      sourceId: source.id,
      status: "ok",
      // itemsSeen counts what we actually attempted; dead URLs are
      // pre-filtered and effectively never made it into the pipeline.
      itemsSeen: liveItems.length,
      itemsInserted: counts.inserted,
      itemsUpdated: counts.updated,
      itemsDuplicate: counts.duplicate + fuzzyMarked,
    };
    await finishRun(runId, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: IngestResult = {
      sourceId: source.id,
      status: "failed",
      itemsSeen: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsDuplicate: 0,
      error: message,
    };
    try {
      await finishRun(runId, result);
    } catch (finishErr) {
      // finishRun is an UPDATE — if it fails the original row stays at
      // status='running', which would silently hide this failure from
      // recentFailureStreak (its loop breaks on any non-'failed' row).
      // Log the swallowed error and insert a fresh sentinel row so the
      // streak guard still trips after enough back-to-back failures.
      console.error(
        `[ingest:${source.id}] finishRun failed for run ${runId}; writing sentinel`,
        finishErr,
      );
      try {
        await writeFailedRunSentinel(
          source.id,
          streak + 1,
          `finishRun failed: ${message}`,
        );
        console.error(
          `[ingest:${source.id}] wrote failed-run sentinel for ${runId}`,
        );
      } catch (sentinelErr) {
        console.error(
          `[ingest:${source.id}] sentinel insert also failed for ${runId}`,
          sentinelErr,
        );
      }
    }
    return result;
  }
}

const URL_CHECK_CONCURRENCY = 8;
// Image gen + upload is slow (~5-10s per AI image) and OpenRouter rate-limits
// concurrent calls per key. Keep this low so a 30-item Instagram pull doesn't
// blow through the rate limit on its first run.
const IMAGE_PIPELINE_CONCURRENCY = 3;

async function resolveImagesForBatch(
  pairs: Array<{ row: ListingInsert; venue: VenueRow | null }>,
  sourceId: string,
): Promise<ListingInsert[]> {
  if (pairs.length === 0) return [];
  const results = new Array<ListingInsert | null>(pairs.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(IMAGE_PIPELINE_CONCURRENCY, pairs.length) },
    async () => {
      while (cursor < pairs.length) {
        const idx = cursor++;
        const { row, venue } = pairs[idx];
        try {
          const img = await resolveListingImage({
            slug: row.slug,
            sourceImageUrl: row.image_url,
            sourcePageUrl: row.source_url,
            meta: {
              title: row.title,
              category: row.category,
              neighborhood: row.neighborhood,
              venueName: venue?.name ?? null,
              type: row.type,
            },
          });
          results[idx] = { ...row, image_url: img.url, image_source: img.source };
          if (img.source !== "scraped") {
            console.log(
              `[ingest:${sourceId}] image ${img.source} for ${row.slug}` +
                (img.reason ? ` (source ${img.reason})` : ""),
            );
          }
        } catch (err) {
          console.error(
            `[ingest:${sourceId}] image pipeline failed for ${row.slug} — dropping`,
            err,
          );
          results[idx] = null;
        }
      }
    },
  );
  await Promise.all(workers);
  return results.filter((r): r is ListingInsert => r !== null);
}

async function filterLiveUrls(items: RawItem[], sourceId: string): Promise<RawItem[]> {
  const results = new Array<RawItem | null>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(URL_CHECK_CONCURRENCY, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        const item = items[idx];
        if (!item.sourceUrl) {
          results[idx] = item;
          continue;
        }
        try {
          const check = await checkUrl(item.sourceUrl);
          if (check.status === "dead") {
            console.log(
              `[ingest:${sourceId}] dropping dead url (${check.httpStatus ?? check.reason}): ${item.sourceUrl}`,
            );
            results[idx] = null;
          } else {
            results[idx] = item;
          }
        } catch (err) {
          // Treat unexpected checker errors as "unknown" — keep the item.
          console.error(`[ingest:${sourceId}] url check threw for ${item.sourceUrl}`, err);
          results[idx] = item;
        }
      }
    },
  );
  await Promise.all(workers);
  return results.filter((r): r is RawItem => r !== null);
}
