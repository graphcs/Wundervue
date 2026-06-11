import * as cheerio from "cheerio";
import type { RawItem, SourceConfig } from "../types";
import { fetchText } from "./feedFetch";
import { htmlToText } from "./htmlText";

// Avery Brewing's taproom-events page is a Next.js (pages-router) site whose
// events live only in the __NEXT_DATA__ payload — a Strapi "page-components.
// taproom-events" component with a featuredEvent plus an accordionItems array,
// each carrying title / dateTimeText / description. The collapsed accordion
// bodies aren't in the static DOM, so we read the JSON. dateTimeText is a human
// recurrence string ("Tuesdays | 5:30 PM", "1st, 3rd & 5th Sundays") the
// normalizer resolves to the next occurrence. Single venue, pinned.
const COMPONENT = "page-components.taproom-events";

interface NextEvent {
  id?: number;
  title?: string;
  dateTimeText?: string;
  description?: string;
  image?: { url?: string; data?: { attributes?: { url?: string } } };
}

function imageUrl(img: NextEvent["image"]): string | undefined {
  const u = img?.url ?? img?.data?.attributes?.url;
  return u && u.startsWith("http") ? u : undefined;
}

export async function fetchAveryTaproomEvents(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single url`);
  }
  const html = await fetchText(source.url);
  const raw = cheerio.load(html)("#__NEXT_DATA__").html();
  if (!raw) throw new Error(`source ${source.id}: no __NEXT_DATA__ on page`);
  const data = JSON.parse(raw) as {
    props?: { pageProps?: { content?: { components?: Array<Record<string, unknown>> } } };
  };
  const components = data.props?.pageProps?.content?.components ?? [];
  const te = components.find((c) => c.__component === COMPONENT) as
    | { featuredEvent?: NextEvent; accordionItems?: NextEvent[] }
    | undefined;
  if (!te) return [];

  const events = [te.featuredEvent, ...(te.accordionItems ?? [])].filter(
    (e): e is NextEvent => Boolean(e),
  );
  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (const e of events) {
    const title = (e.title ?? "").trim();
    if (!title) continue;
    const sourceId = `${source.id}:${e.id ?? title}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const text = [
      title,
      e.dateTimeText?.trim() && `Date: ${e.dateTimeText.trim()}`,
      htmlToText(e.description),
    ]
      .filter(Boolean)
      .join("\n");
    out.push({ sourceId, sourceUrl: source.url, text, imageUrl: imageUrl(e.image), fetchedAt });
  }

  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
