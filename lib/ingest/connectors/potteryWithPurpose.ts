import type { RawItem, SourceConfig } from "../types";
import { fetchJson } from "./feedFetch";

// Pottery With A Purpose runs "Sip & Sculpt"-style pottery workshops at dozens of
// breweries/cafes nationwide, sold through Shopify. Its products.json exposes one
// product per host venue ("Pottery Workshops at <Venue> | <City>, CO"), with each
// upcoming SESSION as a variant ("Sun 7/19 from 1-2:30PM (…)"). We keep the
// Denver-metro venues and emit one event per available variant. Configure with
// `connector: "potteryWithPurpose"` and `url` = the site origin. Multi-venue —
// each event resolves to its host brewery/cafe.
const FAR_CO = /colorado springs|fort collins|\bboulder\b|gunbarrel|pueblo|greeley|loveland|windsor/i;

interface ShopifyVariant {
  id?: number;
  title?: string;
  available?: boolean;
}
interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  body_html?: string;
  images?: Array<{ src?: string }>;
  variants?: ShopifyVariant[];
}
interface ProductsResponse {
  products?: ShopifyProduct[];
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPotteryWithPurpose(source: SourceConfig): Promise<RawItem[]> {
  if (!source.url || Array.isArray(source.url)) {
    throw new Error(`source ${source.id} needs a single base url`);
  }
  const base = source.url.replace(/\/$/, "");
  const data = await fetchJson<ProductsResponse>(`${base}/products.json?limit=250`);
  const products = data.products ?? [];

  const fetchedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (const p of products) {
    const title = p.title?.trim();
    // Keep only Colorado venues in the Denver metro (exclude the distant CO cities).
    if (!title || !/\|\s*[^|]+,\s*CO\b/i.test(title) || FAR_CO.test(title)) continue;
    // "Pottery Workshops at <Venue> | <City>, CO" → venue + city.
    const [namePart, locPart = ""] = title.split("|").map((s) => s.trim());
    const venue = namePart.replace(/^pottery workshops?\s+at\s+/i, "").trim();
    const description = htmlToText(p.body_html ?? "");
    const image = p.images?.[0]?.src;
    const url = p.handle ? `${base}/products/${p.handle}` : base;

    for (const v of p.variants ?? []) {
      // Each available variant is one upcoming session; its title carries the date.
      if (!v.available || !v.title?.trim() || !v.id) continue;
      const sourceId = `${source.id}:${p.id}:${v.id}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      const text = [
        namePart, // "Pottery Workshops at <Venue>"
        `Date: ${v.title.trim()}`,
        locPart && `Venue: ${venue}, ${locPart}`,
        description,
      ]
        .filter(Boolean)
        .join("\n");
      out.push({ sourceId, sourceUrl: url, text, imageUrl: image, fetchedAt });
    }
  }
  return source.maxItems ? out.slice(0, source.maxItems) : out;
}
