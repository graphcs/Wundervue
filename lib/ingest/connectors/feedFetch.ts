import { withRetry } from "../retry";

// Shared fetch-with-retry for feed connectors: one User-Agent, one error shape,
// transient failures retried. Connectors that pull a single page/feed (cheerio,
// json-ld, ics, libcal, …) use these instead of re-inlining the boilerplate.
const USER_AGENT = "WundervueBot/1.0 (+https://wundervue.com)";

// Read the body INSIDE the retry so a transient body-read or JSON-parse failure
// (truncated response, a 200 that's actually an HTML error page) is retried too,
// not just the connection/status.
async function fetchWith<T>(
  url: string,
  extraHeaders: Record<string, string> | undefined,
  extract: (res: Response) => Promise<T>,
): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...extraHeaders } });
    if (!res.ok) throw new Error(`fetch ${url} failed: status ${res.status}`);
    return extract(res);
  });
}

export function fetchText(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  return fetchWith(url, extraHeaders, (res) => res.text());
}

export function fetchJson<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
  return fetchWith(url, extraHeaders, (res) => res.json() as Promise<T>);
}
