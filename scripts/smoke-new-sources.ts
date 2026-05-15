// Exercises the visitdenver / Ticketmaster / Eventbrite connectors against
// the live URLs and prints how many RawItems each one produces, plus a
// single sample. No DB writes, no LLM calls, no image pipeline — this is
// just "did the scrape return events".
//
// Run: npx tsx scripts/smoke-new-sources.ts
import { fetchCheerioWeb } from "../lib/ingest/connectors/cheerioWeb";
import { fetchJsonLdEvents } from "../lib/ingest/connectors/jsonLdEvents";
import { getSource } from "../lib/ingest/sources";

const ids = ["visitdenver-events", "ticketmaster-denver", "eventbrite-denver"];

async function main() {
  for (const id of ids) {
    const source = getSource(id);
    if (!source) {
      console.error(`✗ ${id}: missing from sources.ts`);
      continue;
    }
    const t0 = Date.now();
    try {
      const items =
        source.connector === "cheerioWeb"
          ? await fetchCheerioWeb(source)
          : await fetchJsonLdEvents(source);
      const ms = Date.now() - t0;
      console.log(`\n✓ ${id}: ${items.length} events (${ms}ms)`);
      const sample = items[0];
      if (sample) {
        console.log(`  sample title: ${sample.text.split("\n")[0]}`);
        console.log(`  sample venue: ${sample.venueName ?? "—"}`);
        console.log(`  sample url:   ${sample.sourceUrl ?? "—"}`);
        console.log(`  sample img:   ${sample.imageUrl ? "yes" : "no"}`);
      }
    } catch (err) {
      console.error(`✗ ${id}:`, (err as Error).message);
    }
  }
}

void main();
