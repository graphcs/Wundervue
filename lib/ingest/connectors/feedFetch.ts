import { withRetry } from "../retry";

// Shared fetch-with-retry for feed connectors: one User-Agent, one error shape,
// transient failures retried. Connectors that pull a single page/feed (cheerio,
// json-ld, ics, libcal, …) use these instead of re-inlining the boilerplate.
const USER_AGENT = "WundervueBot/1.0 (+https://wundervue.com)";

async function fetchOk(url: string, extraHeaders?: Record<string, string>): Promise<Response> {
  return withRetry(async () => {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...extraHeaders } });
    if (!res.ok) throw new Error(`fetch ${url} failed: status ${res.status}`);
    return res;
  });
}

export async function fetchText(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  return (await fetchOk(url, extraHeaders)).text();
}

export async function fetchJson<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
  return (await fetchOk(url, extraHeaders)).json() as Promise<T>;
}
