-- Auto-discovered metro cities that aren't in the curated code taxonomy
-- (lib/data/locations.ts). The static tree stays the source of truth; this
-- table is purely additive — a flat list of cities, each pinned to an existing
-- static region_slug assigned by point-in-polygon at ingest time
-- (lib/ingest/persist.ts ensureMetroCity). Read at runtime by
-- lib/data/dynamicCities.server.ts and merged into the taxonomy registry.
create table if not exists public.metro_cities (
  slug         text primary key,
  label        text not null,
  region_slug  text not null,
  lat          double precision,
  lng          double precision,
  source       text not null default 'auto',
  created_at   timestamptz not null default now()
);

create index if not exists metro_cities_region_slug_idx on public.metro_cities(region_slug);

-- Read by the anon (publishable-key) client in the server loader; writes go
-- through the service-role client during ingest (bypasses RLS).
alter table public.metro_cities enable row level security;
drop policy if exists metro_cities_read on public.metro_cities;
create policy metro_cities_read on public.metro_cities for select using (true);
