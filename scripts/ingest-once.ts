#!/usr/bin/env tsx
/**
 * Manual single-source ingest. Bypasses the route handler's auth check;
 * uses the same orchestrator code path as cron.
 *
 * Usage: tsx scripts/ingest-once.ts <source-id>
 */
import { ingestSource } from "@/lib/ingest/orchestrator";
import { getSource, SOURCES } from "@/lib/ingest/sources";

async function main() {
  const sourceId = process.argv[2];
  if (!sourceId) {
    console.error("usage: tsx scripts/ingest-once.ts <source-id>");
    console.error("\navailable sources:");
    for (const s of SOURCES) {
      console.error(`  ${s.id}\t${s.connector}\t${s.cadence}\t${s.enabled ? "enabled" : "disabled"}`);
    }
    process.exit(1);
  }
  const source = getSource(sourceId);
  if (!source) {
    console.error(`unknown source: ${sourceId}`);
    process.exit(1);
  }
  console.log(`[ingest:${sourceId}] starting`);
  const result = await ingestSource(source);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "failed" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
