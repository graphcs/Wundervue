import type { IngestResult, ListingInsert, NormalizedListing, RawItem, SourceConfig } from "./types";
import { fetchInstagram } from "./connectors/instagram";
import { fetchInstagramVision } from "./connectors/instagramVision";
import { fetchSerpEvents } from "./connectors/serpEvents";
import { fetchApifyWeb } from "./connectors/apifyWeb";
import { fetchCheerioWeb } from "./connectors/cheerioWeb";
import { fetchVenuePilot } from "./connectors/venuePilot";
import { fetchWixEvents } from "./connectors/wixEvents";
import { fetchFullCalendarFeed } from "./connectors/fullCalendarFeed";
import { fetchMlbSchedule } from "./connectors/mlbSchedule";
import { fetchNbaSchedule } from "./connectors/nbaSchedule";
import { fetchNhlSchedule } from "./connectors/nhlSchedule";
import { fetchNflSchedule } from "./connectors/nflSchedule";
import { fetchAquariumCalendar } from "./connectors/aquariumCalendar";
import { fetchWpRestEvents } from "./connectors/wpRestEvents";
import { fetchComedyWorksCalendar } from "./connectors/comedyWorksCalendar";
import { fetchDenverUnionStation } from "./connectors/denverUnionStation";
import { fetchSquarespaceEvents } from "./connectors/squarespaceEvents";
import { fetchTribeEvents } from "./connectors/tribeEvents";
import { fetchBotanicGardensCalendar } from "./connectors/botanicGardensCalendar";
import { fetchEventRssFeed } from "./connectors/eventRssFeed";
import { fetchDenverSummitFcSchedule } from "./connectors/denverSummitFcSchedule";
import { fetchTicketmasterVenue } from "./connectors/ticketmasterVenue";
import { fetchJsonLdEvents } from "./connectors/jsonLdEvents";
import { fetchIcsCalendar } from "./connectors/icsCalendar";
import { fetchElfsightCalendar } from "./connectors/elfsightCalendar";
import { fetchLocalistEvents } from "./connectors/localistEvents";
import { fetchCityLightEvents } from "./connectors/cityLightEvents";
import { fetchLibCalEvents } from "./connectors/libcalEvents";
import { fetchPotteryWithPurpose } from "./connectors/potteryWithPurpose";
import { fetchEventive } from "./connectors/eventive";
import { fetchDmnsEvents } from "./connectors/dmnsEvents";
import { fetchAegEvents } from "./connectors/aegEvents";
import { fetchCherryCricketDeals } from "./connectors/cherryCricketDeals";
import { fetchPopmenuEvents } from "./connectors/popmenuEvents";
import { fetchSquarespaceProducts } from "./connectors/squarespaceProducts";
import { fetchFlyerImage } from "./connectors/flyerImage";
import { fetchScreenshotVision } from "./connectors/screenshotVision";
import { fetchAveryTaproomEvents } from "./connectors/averyTaproomEvents";
import { createHash } from "node:crypto";
import { normalize, normalizeMulti } from "./normalize";
import { checkUrl } from "./checkUrl";
import {
  clusterAndMarkDuplicates,
  mergeVenueTitleDuplicates,
  reconcileVenueDuplicates,
} from "./dedupCluster";
import { mergeDuplicateVenues } from "./venueMerge";
import { expandRecurringOccurrences } from "./expandOccurrences";
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
    case "instagramVision":
      return fetchInstagramVision(source);
    case "serpEvents":
      return fetchSerpEvents(source);
    case "apifyWeb":
      return fetchApifyWeb(source);
    case "cheerioWeb":
      return fetchCheerioWeb(source);
    case "venuePilot":
      return fetchVenuePilot(source);
    case "wixEvents":
      return fetchWixEvents(source);
    case "fullCalendarFeed":
      return fetchFullCalendarFeed(source);
    case "mlbSchedule":
      return fetchMlbSchedule(source);
    case "nbaSchedule":
      return fetchNbaSchedule(source);
    case "nhlSchedule":
      return fetchNhlSchedule(source);
    case "nflSchedule":
      return fetchNflSchedule(source);
    case "aquariumCalendar":
      return fetchAquariumCalendar(source);
    case "wpRestEvents":
      return fetchWpRestEvents(source);
    case "comedyWorksCalendar":
      return fetchComedyWorksCalendar(source);
    case "denverUnionStation":
      return fetchDenverUnionStation(source);
    case "squarespaceEvents":
      return fetchSquarespaceEvents(source);
    case "tribeEvents":
      return fetchTribeEvents(source);
    case "botanicGardensCalendar":
      return fetchBotanicGardensCalendar(source);
    case "eventRssFeed":
      return fetchEventRssFeed(source);
    case "denverSummitFcSchedule":
      return fetchDenverSummitFcSchedule(source);
    case "ticketmasterVenue":
      return fetchTicketmasterVenue(source);
    case "jsonLdEvents":
      return fetchJsonLdEvents(source);
    case "icsCalendar":
      return fetchIcsCalendar(source);
    case "elfsightCalendar":
      return fetchElfsightCalendar(source);
    case "localistEvents":
      return fetchLocalistEvents(source);
    case "cityLightEvents":
      return fetchCityLightEvents(source);
    case "libcalEvents":
      return fetchLibCalEvents(source);
    case "potteryWithPurpose":
      return fetchPotteryWithPurpose(source);
    case "averyTaproomEvents":
      return fetchAveryTaproomEvents(source);
    case "eventive":
      return fetchEventive(source);
    case "dmnsEvents":
      return fetchDmnsEvents(source);
    case "aegEvents":
      return fetchAegEvents(source);
    case "cherryCricketDeals":
      return fetchCherryCricketDeals(source);
    case "popmenuEvents":
      return fetchPopmenuEvents(source);
    case "squarespaceProducts":
      return fetchSquarespaceProducts(source);
    case "flyerImage":
      return fetchFlyerImage(source);
    case "screenshotVision":
      return fetchScreenshotVision(source);
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

    // Normalize with BOUNDED concurrency. An unbounded Promise.all over a large
    // batch fires 20+ simultaneous LLM calls; OpenRouter throttles per key, and a
    // throttled call returns without a tool block, so normalize yields null and
    // the event is silently dropped (it passes in isolation but loses the race in
    // the full run). Cap it like the image/URL stages.
    type NormPair = { item: RawItem; result: NormalizedListing };
    const normalizeItem = async (item: RawItem): Promise<NormPair[]> => {
      try {
        // Instagram captions describe events relative to when the POST was made
        // ("tonight", "this Friday", a year-less "April 25"). The IG connectors
        // set item.fetchedAt to the post timestamp, so anchor relative-date
        // resolution to that instead of today — otherwise an old post resurfaces
        // as a fake future event. Other connectors fetchedAt ≈ now, so this is a
        // no-op for them; undefined falls back to normalize()'s today default.
        const isInstagram =
          source.connector === "instagram" || source.connector === "instagramVision";
        const currentDate =
          isInstagram && item.fetchedAt && !Number.isNaN(Date.parse(item.fetchedAt))
            ? item.fetchedAt.slice(0, 10)
            : undefined;
        // Opt-in multi-event sources only (e.g. venues that post monthly
        // roundups). Every other source takes the unchanged single-event path.
        if (source.multiEvent) {
          const results = await normalizeMulti({ item, source, currentDate });
          return results.map((result) => {
            // Content-stable per-event id (order-independent) so re-runs update
            // rather than duplicate the same event from the same post. A
            // recurring event advances dateStart to the next occurrence every
            // run, so keying on that day would re-key (and duplicate) it each
            // run — use the stable dateDisplay ("Every Tuesday") instead.
            const dateKey = result.recurring
              ? result.dateDisplay || "recurring"
              : (result.dateStart?.slice(0, 10) ?? result.dateDisplay);
            const key = `${result.canonicalTitle}|${dateKey}`;
            const suffix = createHash("sha1").update(key).digest("hex").slice(0, 10);
            return { item: { ...item, sourceId: `${item.sourceId}#${suffix}` }, result };
          });
        }
        const result = await normalize({ item, source, currentDate });
        return result ? [{ item, result }] : [];
      } catch (err) {
        console.error(`[ingest:${source.id}] normalize failed for ${item.sourceId}`, err);
        return [];
      }
    };
    const normalizedNested = new Array<NormPair[]>(liveItems.length);
    let normCursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(NORMALIZE_CONCURRENCY, liveItems.length) }, async () => {
        while (normCursor < liveItems.length) {
          const idx = normCursor++;
          normalizedNested[idx] = await normalizeItem(liveItems[idx]);
        }
      }),
    );
    const normalized = normalizedNested.flat();

    // Resolve a venue per item. Sequential because the geocoder rate-limits
    // (1 req/sec public Nominatim quota) — parallelising would just queue
    // anyway, and within-run caching collapses repeat venues to one call.
    const pairs: Array<{
      row: ListingInsert;
      venue: VenueRow | null;
    }> = [];
    for (const n of normalized) {
      if (!n) continue;
      // A source with a configured address is single-venue: pin every post to it
      // authoritatively. The per-post name/neighborhood the LLM guesses from
      // captions otherwise spawns duplicate venue rows and a wrong neighborhood
      // (e.g. an IG caption placing a S. Broadway bar in "LoDo"), so prefer the
      // config and reverse-geocode the neighborhood from the pin. Multi-venue
      // sources (no defaultVenueAddress) keep resolving per post.
      const pinSingle = Boolean(source.defaultVenueAddress);
      const venue = await resolveOrCreateVenue({
        defaultVenueSlug: source.defaultVenueSlug,
        venueName: pinSingle
          ? source.defaultVenueName ?? n.result.venueName
          : n.result.venueName ?? source.defaultVenueName ?? null,
        address: pinSingle
          ? source.defaultVenueAddress ?? n.result.address
          : n.result.address ?? source.defaultVenueAddress ?? null,
        neighborhood: pinSingle ? source.defaultNeighborhood ?? null : n.result.neighborhood,
        city: source.cityHint,
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

    // Split recurring WEEKLY events into one row per upcoming occurrence (a
    // specific day + time). Done after image resolution so every occurrence
    // clones the series' single resolved image instead of generating its own.
    const normalizedBySourceId = new Map(normalized.map((n) => [n.item.sourceId, n.result]));
    const expanded = expandRecurringOccurrences(withImages, normalizedBySourceId);

    const actions = await classifyForUpsert(expanded);
    const counts = await applyBatch(actions);

    let batchVenueIds = [
      ...new Set(
        expanded.map((r) => r.venue_id).filter((v): v is string => Boolean(v)),
      ),
    ];

    // Consolidate duplicate venue rows touched by this batch BEFORE deduping
    // events: the same show pinned to fragmented venue rows ("The Outpost on
    // Platte" vs "Station 26 Brewing - The Outpost on Platte") otherwise escapes
    // the same-venue dedup passes below. Merging onto one canonical row lets them
    // collapse it. Failures never fail the run.
    try {
      const vm = await mergeDuplicateVenues({ onlyVenueIds: batchVenueIds });
      if (vm.venuesRemoved > 0) {
        console.log(
          `[ingest:${source.id}] merged ${vm.venuesRemoved} duplicate venue(s) across ${vm.merges.length} group(s)`,
        );
        batchVenueIds = [...new Set([...batchVenueIds, ...vm.canonicalIds])];
      }
    } catch (err) {
      console.error(`[ingest:${source.id}] venue merge failed`, err);
    }

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

    // Venue-scoped title dedup: merges the same exhibition/event posted to a
    // venue multiple times with different (or no) dates — the case the same-day
    // cluster pass above can't see. Safe for recurring series (a date-distance
    // guard keeps weekly same-title events separate).
    try {
      const merged = await mergeVenueTitleDuplicates(source.sourceLabel);
      fuzzyMarked += merged.markedDuplicate;
    } catch (err) {
      console.error(`[ingest:${source.id}] venue-title dedup failed`, err);
    }

    // Reconcile each touched venue's duplicate clusters: prefer the
    // authoritative source as the visible row (a venue's ticketing Website beats
    // an Instagram repost of the same show, so the survivor keeps the real
    // showtime/ticket link/art), and roll same-day duplicate showtimes onto the
    // canonical ("7:00 PM & 9:30 PM"). Runs for every venue in the batch,
    // including update-only re-ingests.
    try {
      if (batchVenueIds.length > 0) await reconcileVenueDuplicates(batchVenueIds);
    } catch (err) {
      console.error(`[ingest:${source.id}] venue dedup reconcile failed`, err);
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
// One LLM tool call per item; OpenRouter throttles concurrent calls per key, so
// cap the batch (an unbounded fan-out drops events to tool-less throttled responses).
const NORMALIZE_CONCURRENCY = 5;
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
