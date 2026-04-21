import type { NeighborhoodOption } from "@/lib/types";

export const NEIGHBORHOODS: NeighborhoodOption[] = [
  { slug: "rino", label: "RiNo" },
  { slug: "lohi", label: "LoHi" },
  { slug: "highlands", label: "Highlands" },
  { slug: "cherry-creek", label: "Cherry Creek" },
  { slug: "downtown", label: "Downtown" },
  { slug: "capitol-hill", label: "Capitol Hill" },
  { slug: "baker", label: "Baker" },
  { slug: "wash-park", label: "Wash Park" },
  { slug: "golden", label: "Golden" },
];

export const ONBOARDING_NEIGHBORHOODS = [
  "RiNo",
  "LoHi",
  "Highlands",
  "Cherry Creek",
  "Downtown",
  "Capitol Hill",
  "Baker",
  "Wash Park",
  "Golden",
  "South Broadway",
  "City Park",
  "Sloan's Lake",
];

const LABEL_TO_SLUG = new Map(
  NEIGHBORHOODS.map((n) => [n.label.toLowerCase(), n.slug]),
);
const SLUG_TO_LABEL = new Map(NEIGHBORHOODS.map((n) => [n.slug, n.label]));

export function neighborhoodSlug(label: string): string | undefined {
  return LABEL_TO_SLUG.get(label.toLowerCase());
}

export function neighborhoodLabel(slug: string): string | undefined {
  return SLUG_TO_LABEL.get(slug);
}
