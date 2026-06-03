/**
 * Soft-flag listings whose effective end date is in the past (strictly before
 * 00:00 UTC today) by setting is_past = true. Defaults to dry-run; pass --apply
 * to write. Rows are preserved (not deleted) so saved past listings resolve.
 *
 *   tsx scripts/expire-past-events.ts            # dry-run
 *   tsx scripts/expire-past-events.ts --apply
 */
import { expirePastEvents } from "@/lib/maintenance/expirePastEvents";

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await expirePastEvents({ apply, log: (m) => console.log(m) });
  console.log(
    `\ncutoff=${result.cutoff} found=${result.found} flagged=${result.flagged}`,
  );
  if (!apply && result.found > 0) {
    console.log(`dry-run: re-run with --apply to flag ${result.found} listings`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
