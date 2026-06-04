/**
 * One-off: run a raw .sql file against the database in SUPABASE_DB_URL.
 * Used to apply migrations directly when `supabase db push` is blocked by a
 * migration-history mismatch. Statements are idempotent (if not exists).
 *
 * Requires `pg`, which is intentionally NOT a project dependency (this is a
 * dev-only utility). Install it on demand before running:
 *
 *   npm install --no-save pg
 *   SUPABASE_DB_URL=... node scripts/apply-sql.mjs supabase/migrations/<file>.sql
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
const file = process.argv[2];
if (!url) throw new Error("SUPABASE_DB_URL is not set");
if (!file) throw new Error("usage: node scripts/apply-sql.mjs <file.sql>");

const sql = readFileSync(file, "utf8");
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log(`applied ${file}`);
} finally {
  await client.end();
}
