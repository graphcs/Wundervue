import type { CategoryOption } from "@/lib/types";

export const CATEGORIES: CategoryOption[] = [
  { slug: "music", label: "Music" },
  { slug: "food-drink", label: "Food & Drink" },
  { slug: "outdoor", label: "Outdoor" },
  { slug: "arts-culture", label: "Arts & Culture" },
  { slug: "markets", label: "Markets" },
  { slug: "sports", label: "Sports" },
  { slug: "comedy", label: "Comedy" },
  { slug: "wellness", label: "Wellness" },
];

export const ONBOARDING_INTERESTS = [
  { id: "concerts", label: "Concerts & Live Music", icon: "🎵" },
  { id: "food", label: "Food & Drink", icon: "🍽" },
  { id: "outdoor", label: "Outdoor & Nature", icon: "🏔️" },
  { id: "arts", label: "Arts & Culture", icon: "🎨" },
  { id: "nightlife", label: "Nightlife & Bars", icon: "🌙" },
  { id: "sports", label: "Sports & Fitness", icon: "⚽" },
  { id: "comedy", label: "Comedy & Shows", icon: "😂" },
  { id: "markets", label: "Markets & Pop-Ups", icon: "🛍" },
  { id: "wellness", label: "Wellness & Yoga", icon: "🧘" },
  { id: "family", label: "Family & Kids", icon: "👨‍👩‍👧" },
  { id: "dogs", label: "Dog-Friendly", icon: "🐕" },
  { id: "free", label: "Free Events", icon: "✨" },
];

const LABEL_TO_SLUG = new Map(
  CATEGORIES.map((c) => [c.label.toLowerCase(), c.slug]),
);
const SLUG_TO_LABEL = new Map(CATEGORIES.map((c) => [c.slug, c.label]));

export function categorySlug(label: string): string | undefined {
  return LABEL_TO_SLUG.get(label.toLowerCase());
}

export function categoryLabel(slug: string): string | undefined {
  return SLUG_TO_LABEL.get(slug);
}
