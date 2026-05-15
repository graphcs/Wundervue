// Probes SerpAPI's Google Events engine with site:-restricted queries for
// each candidate domain, so we can decide whether to add a serpEvents
// source for that site or fall back to apifyWeb (which costs ~$1/run vs
// SerpAPI's ~$0.01/query).
//
// Usage: tsx scripts/probe-serpapi-sites.ts

const probes: Array<{ name: string; q: string }> = [
  { name: "redrocksonline.com", q: "events site:redrocksonline.com Denver" },
  { name: "thehighlandsfarmersmarket.com", q: "events site:thehighlandsfarmersmarket.com" },
  { name: "visitdenverhighlands.com", q: "events site:visitdenverhighlands.com Denver" },
  { name: "milehighonthecheap.com", q: "events site:milehighonthecheap.com Denver" },
];

async function main() {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY not set");

  for (const p of probes) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_events");
    url.searchParams.set("q", p.q);
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");
    url.searchParams.set("api_key", key);

    try {
      const res = await fetch(url);
      const json = (await res.json()) as {
        events_results?: Array<{ title?: string; venue?: { name?: string } }>;
        error?: string;
      };
      if (json.error) {
        console.log(`✗ ${p.name}: error — ${json.error}`);
        continue;
      }
      const events = json.events_results ?? [];
      console.log(`\n${events.length === 0 ? "✗" : "✓"} ${p.name}: ${events.length} events`);
      for (const e of events.slice(0, 3)) {
        console.log(`    — ${e.title?.slice(0, 60)} @ ${e.venue?.name ?? "—"}`);
      }
    } catch (err) {
      console.log(`✗ ${p.name}: fetch failed — ${(err as Error).message}`);
    }
  }
}

void main();
