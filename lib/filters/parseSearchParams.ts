import type {
  Filters,
  DatePreset,
  TypeFilter,
  LifestyleTag,
  PageSize,
  SortOption,
} from "@/lib/types";

const VALID_DATES: DatePreset[] = [
  "any",
  "today",
  "this-weekend",
  "this-week",
  "this-month",
  "next-month",
  "custom",
];
const VALID_TYPES: TypeFilter[] = ["all", "events", "deals", "both"];
const VALID_SORTS: SortOption[] = ["soonest", "latest"];
const VALID_PAGE_SIZES: PageSize[] = [9, 12, 15, 18];
const VALID_LIFESTYLE: LifestyleTag[] = [
  "date-night",
  "dog-friendly",
  "family",
  "outdoor",
];

type ParamValue = string | string[] | undefined;
type ParamMap = Record<string, ParamValue> | URLSearchParams;

function first(params: ParamMap, key: string): string | undefined {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }
  const v = params[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function csv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ParseOptions {
  neighborhoodFromPath?: string;
  categoryFromPath?: string;
}

export function parseSearchParams(
  params: ParamMap,
  options: ParseOptions = {},
): Filters {
  const type = first(params, "type");
  const sort = first(params, "sort");
  const date = first(params, "date");
  const lifestyleRaw = csv(first(params, "lifestyle"));
  const hoodsRaw = csv(first(params, "hoods"));
  const catsRaw = csv(first(params, "cats"));
  const view = first(params, "view");
  const perRaw = first(params, "per");
  const perNum = Number(perRaw);
  const pageSize: PageSize = (VALID_PAGE_SIZES as number[]).includes(perNum)
    ? (perNum as PageSize)
    : 9;

  const neighborhoods = options.neighborhoodFromPath
    ? [options.neighborhoodFromPath, ...hoodsRaw].filter(
        (v, i, a) => a.indexOf(v) === i,
      )
    : hoodsRaw;

  const categories = options.categoryFromPath
    ? [options.categoryFromPath, ...catsRaw].filter(
        (v, i, a) => a.indexOf(v) === i,
      )
    : catsRaw;

  return {
    type: (VALID_TYPES as string[]).includes(type ?? "")
      ? (type as TypeFilter)
      : "all",
    neighborhoods,
    categories,
    date: (VALID_DATES as string[]).includes(date ?? "")
      ? (date as DatePreset)
      : "any",
    from: first(params, "from"),
    to: first(params, "to"),
    lifestyle: lifestyleRaw.filter((t): t is LifestyleTag =>
      (VALID_LIFESTYLE as string[]).includes(t),
    ),
    freeOnly: first(params, "free") === "1",
    q: first(params, "q"),
    sort: (VALID_SORTS as string[]).includes(sort ?? "")
      ? (sort as SortOption)
      : "soonest",
    view: view === "map" ? "map" : view === "calendar" ? "calendar" : "grid",
    pageSize,
    venue: first(params, "venue"),
  };
}
