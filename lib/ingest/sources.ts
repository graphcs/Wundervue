import type { SourceConfig } from "./types";

// Hybrid scraping strategy:
// - SerpAPI (Google Events) for broad, multi-category, multi-venue coverage at low cost.
// - Apify Instagram for deep coverage of specific venues / hashtags Google misses.
// - Apify Web (cheerio-scraper) for JS-heavy or niche sites Google Events doesn't index.
export const SOURCES: SourceConfig[] = [
  // ── SerpAPI: broad coverage by category. Cheap (~$0.01/query), so daily is fine.
  {
    id: "denver-events-search",
    enabled: true,
    connector: "serpEvents",
    cadence: "daily",
    sourceLabel: "Website",
    query: "events in Denver this week",
    serpHtichips: "date:week",
  },
  {
    id: "denver-food-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "food festivals and tastings Denver",
    defaultCategory: "Food & Drink",
  },
  {
    id: "denver-comedy-shows",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "comedy shows Denver",
    defaultCategory: "Comedy",
  },
  {
    id: "denver-arts-culture",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "art shows and gallery openings Denver",
    defaultCategory: "Arts & Culture",
  },
  {
    id: "denver-outdoor-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "outdoor events and farmers markets Denver",
    defaultCategory: "Outdoor",
  },
  {
    id: "denver-music-shows",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "live music and concerts Denver",
    defaultCategory: "Music",
  },
  {
    id: "denver-sports-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "sports events Denver",
    defaultCategory: "Sports",
  },
  {
    id: "denver-wellness-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "yoga and wellness classes Denver",
    defaultCategory: "Wellness",
  },
  {
    // Google Events returned no results for "markets and pop-ups Denver" — overlap
    // with denver-outdoor-events (farmers markets) is heavy. Disabled until we
    // find a query that surfaces non-redundant content.
    id: "denver-markets-popups",
    enabled: false,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "weekend markets Denver",
    defaultCategory: "Markets",
  },
  {
    id: "denver-this-weekend",
    enabled: true,
    connector: "serpEvents",
    cadence: "daily",
    sourceLabel: "Website",
    query: "things to do in Denver this weekend",
    serpHtichips: "date:weekend",
  },
  {
    id: "denver-free-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "free events Denver",
  },
  {
    id: "denver-family-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "family-friendly events Denver",
  },
  {
    // Denver has a strong dog-park / brewery-patio scene; explicit query gets
    // us non-overlapping coverage that "events in Denver this week" misses.
    // Google Events is finicky with the phrase "dog-friendly" — concrete
    // event types ("yappy hour", "dog meetup") return more results than
    // adjective queries.
    id: "denver-dog-friendly-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "dog events Denver",
  },
  {
    // Date-night results were under-tagged because no source explicitly
    // queries for them. Bars, jazz, and cocktail spots get surfaced here so
    // the AI has more candidates to apply the date-night tag.
    id: "denver-date-night-events",
    enabled: true,
    connector: "serpEvents",
    cadence: "weekly",
    sourceLabel: "Website",
    query: "date night spots and live jazz Denver",
  },

  // ── Apify Instagram: per-account deep dives for venues we follow closely.
  {
    id: "mission-ballroom-ig",
    enabled: true,
    connector: "instagram",
    cadence: "daily",
    sourceLabel: "Instagram",
    handle: "missionballroom",
    defaultVenueSlug: "mission-ballroom",
    defaultCategory: "Music",
  },
  {
    // Denver music venues — single source fans out across multiple handles
    // in one Apify run. Add more handles here as we discover venues that
    // post events on Instagram.
    id: "denver-music-venues-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    handle: [
      "ogdentheatre",
      "fillmoredenver",
      "redrocksco",
      "blubirdtheater",
      "hidiveofficial",
      "thelionslairlounge",
    ],
    defaultCategory: "Music",
  },

  // ── Apify Instagram: hashtag scrapes for lifestyle coverage. Hashtags
  // surface community-organized events (yappy hours, dog meetups, brewery
  // patios) that Google Events doesn't index. Multi-hashtag fans out in a
  // single Apify run; per-URL cap is MAX_POSTS in the connector.
  {
    id: "denver-dogs-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denverdogs",
      "denverdogfriendly",
      "yappyhourdenver",
      "milehighdogs",
      "denverdogevents",
    ],
  },
  {
    id: "denver-family-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denverfamily",
      "denverkids",
      "denvermom",
      "milehighmama",
    ],
  },
  {
    id: "denver-outdoor-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denveroutdoors",
      "denverhiking",
      "denverparks",
      "milehighoutdoors",
    ],
  },
  {
    id: "denver-datenight-ig",
    enabled: true,
    connector: "instagram",
    cadence: "weekly",
    sourceLabel: "Instagram",
    hashtag: [
      "denverdatenight",
      "denvercocktails",
      "denverwine",
      "denverjazz",
    ],
  },
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export function getSource(id: string): SourceConfig | undefined {
  return BY_ID.get(id);
}

export function getEnabledSources(cadence?: SourceConfig["cadence"]): SourceConfig[] {
  return SOURCES.filter(
    (s) => s.enabled && (cadence === undefined || s.cadence === cadence),
  );
}
