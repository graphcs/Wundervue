/**
 * Sweep all published listings, HEAD-check each source_url, and unpublish
 * rows whose source page is definitively gone (404 / 410 / DNS).
 *
 * Defaults to dry-run. Pass --apply to actually update the database.
 *
 *   tsx scripts/check-source-urls.ts                  # dry-run
 *   tsx scripts/check-source-urls.ts --apply
 *   tsx scripts/check-source-urls.ts --limit=200 --concurrency=16
 */
import { sweepDeadUrls } from "@/lib/maintenance/sweepDeadUrls";

function numFlag(name: string): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!arg) return undefined;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await sweepDeadUrls({
    apply,
    limit: numFlag("--limit"),
    concurrency: numFlag("--concurrency"),
    log: (m) => console.log(m),
  });
  console.log(
    `\nscanned=${result.scanned} alive=${result.alive} dead=${result.dead} unknown=${result.unknown} unpublished=${result.unpublished}`,
  );
  if (!apply && result.dead > 0) {
    console.log(`dry-run: re-run with --apply to unpublish ${result.dead} listings`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
