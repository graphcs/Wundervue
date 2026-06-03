-- Location hierarchy (Area → Region → City → Neighborhood).
--
-- The taxonomy itself is a versioned code constant (lib/data/locations.ts), so
-- we denormalize the resolved slugs onto each row rather than introducing a
-- locations table + FKs. The existing flat `neighborhood` text column is kept
-- as a display cache. Slugs are populated by scripts/backfill-locations.ts and,
-- going forward, by the ingest normalizer.

alter table public.listings
  add column if not exists region_slug text,
  add column if not exists city_slug text,
  add column if not exists neighborhood_slug text;

alter table public.venues
  add column if not exists region_slug text,
  add column if not exists city_slug text,
  add column if not exists neighborhood_slug text;

-- Profiles store a user's preferred locations as a set of taxonomy slugs
-- (region/city/neighborhood). Coexists with the legacy `neighborhoods` labels.
alter table public.profiles
  add column if not exists location_slugs text[] not null default '{}';

create index if not exists listings_region_slug_idx on public.listings(region_slug) where published_at is not null;
create index if not exists listings_city_slug_idx on public.listings(city_slug) where published_at is not null;
create index if not exists listings_neighborhood_slug_idx on public.listings(neighborhood_slug) where published_at is not null;
create index if not exists venues_region_slug_idx on public.venues(region_slug);
create index if not exists venues_city_slug_idx on public.venues(city_slug);
