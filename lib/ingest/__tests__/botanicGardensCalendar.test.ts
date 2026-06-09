import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBotanicGardensCalendar } from "../connectors/botanicGardensCalendar";
import type { SourceConfig } from "../types";

const source: SourceConfig = {
  id: "denver-botanic-gardens-web",
  enabled: true,
  connector: "botanicGardensCalendar",
  cadence: "weekly",
  sourceLabel: "Website",
  url: "https://www.botanicgardens.org/calendar",
};

function card(opts: {
  href: string;
  location: string;
  title: string;
  date: string;
  times?: string[];
  tags: string;
}): string {
  const times = (opts.times ?? []).map((t) => `<span class="datetime">${t}</span>`).join("");
  return `<div class="views-row"><article class="node node--type-program-instance">
    <div class="location-banner"><div class="field field--name-field-atms-location field__item">${opts.location}</div></div>
    <h3><a class="program-link" href="${opts.href}"><span>${opts.title}</span></a></h3>
    ${times}
    <div class="program-date">${opts.date} |</div>
    <div class="program-tags">${opts.tags}</div>
  </article></div>`;
}

// page 0: yoga (Jun 9) + seedlings, then yoga again (Jun 10) = recurring dup.
const LIST_P0 = `<html><body>
  ${card({ href: "/programs/yoga", location: "York Street", title: "Sunrise Vinyasa Yoga at the Gardens", date: "June 9, 2026", times: ["7:30", "8:30 a.m."], tags: "Adults, Health &amp; Wellness" })}
  ${card({ href: "/programs/seedlings", location: "York Street", title: "Seedlings: Pick a Salad", date: "June 9, 2026", times: ["9:15", "10:00 a.m."], tags: "Children" })}
  ${card({ href: "/programs/yoga", location: "York Street", title: "Sunrise Vinyasa Yoga at the Gardens", date: "June 10, 2026", times: ["7:30", "8:30 a.m."], tags: "Adults, Health &amp; Wellness" })}
</body></html>`;
// page 1: a Chatfield program; page 2: empty → stops paging.
const LIST_P1 = `<html><body>
  ${card({ href: "/programs/pumpkin", location: "Chatfield Farms", title: "Pumpkin Festival", date: "October 4, 2026", tags: "Families" })}
</body></html>`;
const LIST_P2 = `<html><body></body></html>`;

function detail(title: string, desc: string, img: string): string {
  return `<html><head>
    <meta property="og:title" content="${title} | Denver Botanic Gardens" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${img}" />
  </head><body><h1>${title}</h1></body></html>`;
}
const PAGES: Record<string, string> = {
  "page=0": LIST_P0,
  "page=1": LIST_P1,
  "page=2": LIST_P2,
  "/programs/yoga": detail("Sunrise Vinyasa Yoga at the Gardens", "Practice yoga in nature.", "https://img/yoga.jpg"),
  "/programs/seedlings": detail("Seedlings: Pick a Salad", "A salad adventure for kids.", "https://img/seed.jpg"),
  "/programs/pumpkin": detail("Pumpkin Festival", "Fall fun on the farm.", "https://img/pumpkin.jpg"),
};

function routeFetch() {
  return vi.fn(async (u: string) => {
    const key = Object.keys(PAGES).find((k) => u.includes(k));
    return { ok: true, status: 200, text: async () => (key ? PAGES[key] : "") };
  });
}

describe("fetchBotanicGardensCalendar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pages the list, dedupes recurring programs, enriches from detail OG tags", async () => {
    vi.stubGlobal("fetch", routeFetch());
    const items = await fetchBotanicGardensCalendar(source);
    const titles = items.map((i) => i.text.split("\n")[0]);
    expect(titles).toEqual([
      "Sunrise Vinyasa Yoga at the Gardens", // deduped to the Jun 9 instance
      "Seedlings: Pick a Salad",
      "Pumpkin Festival", // came from page 1
    ]);
    expect(titles.filter((t) => t.startsWith("Sunrise"))).toHaveLength(1);
  });

  it("builds the blob from card date/time/category + detail OG, maps the venue", async () => {
    vi.stubGlobal("fetch", routeFetch());
    const items = await fetchBotanicGardensCalendar(source);
    const yoga = items[0];
    expect(yoga.text).toContain("Date: June 9, 2026"); // soonest instance, not Jun 10
    expect(yoga.text).toContain("Time: 7:30 – 8:30 a.m.");
    expect(yoga.text).toContain("Category: Adults, Health & Wellness");
    expect(yoga.text).toContain("Practice yoga in nature."); // og:description
    expect(yoga.text).toContain("Venue: Denver Botanic Gardens, 1007 York St, Denver, CO 80206");
    expect(yoga.imageUrl).toBe("https://img/yoga.jpg");
    expect(yoga.sourceUrl).toBe("https://www.botanicgardens.org/programs/yoga");
    expect(yoga.venueName).toBe("Denver Botanic Gardens");

    const pumpkin = items[2];
    expect(pumpkin.venueName).toBe("Denver Botanic Gardens Chatfield Farms");
    expect(pumpkin.address).toContain("Littleton");
  });

  it("respects maxItems (and stops paging once filled)", async () => {
    const f = routeFetch();
    vi.stubGlobal("fetch", f);
    const items = await fetchBotanicGardensCalendar({ ...source, maxItems: 2 });
    expect(items.map((i) => i.text.split("\n")[0])).toEqual([
      "Sunrise Vinyasa Yoga at the Gardens",
      "Seedlings: Pick a Salad",
    ]);
    expect(f.mock.calls.some((c) => String(c[0]).includes("page=1"))).toBe(false);
  });

  it("throws when url is missing", async () => {
    await expect(fetchBotanicGardensCalendar({ ...source, url: undefined })).rejects.toThrow(/missing url/);
  });
});
