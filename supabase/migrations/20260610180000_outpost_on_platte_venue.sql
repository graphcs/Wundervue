-- Canonicalize "The Outpost on Platte" (the Platte Street event lawn beside
-- Station 26 Brewing, home of the Sunset Sessions music series). On the shared DB
-- it had fragmented into several rows, two of them geocoded to Washington State
-- (lat 48.27), so the recurring Sunset Sessions captured by several sources
-- scattered across them. `do update` repairs the bad coords/address on the
-- existing row and seeds it on a fresh DB. (The duplicate venue rows are merged
-- out separately as a one-off data repair on the shared DB — they don't exist on a
-- fresh DB.)
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('the-outpost-on-platte', 'The Outpost on Platte', 'An outdoor event lawn and bar on Platte Street beside Station 26 Brewing, host to the weekly summer Sunset Sessions live-music series.', '1635 Platte St, Denver, CO 80211', 'Highland', 39.7586, -105.0054)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  address = excluded.address,
  neighborhood = excluded.neighborhood,
  lat = excluded.lat,
  lng = excluded.lng;
