-- Venue categories: a venue is tagged by the kinds of listings it hosts
-- (music, food-drink, …) plus "family-friendly" derived from the family
-- lifestyle tag. Populated by scripts/backfill-venue-categories.mts from each
-- venue's listings; kept as a denormalized text[] for cheap chip rendering and
-- category filtering on the venues browse page.

alter table public.venues
  add column if not exists categories text[] not null default '{}';

create index if not exists venues_categories_idx on public.venues using gin (categories);
