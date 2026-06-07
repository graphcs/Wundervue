-- Seed the Cerebral West Highland taproom as its own venue. Cerebral runs three
-- taprooms; only Congress Park (cerebral-brewing) was seeded. The West Highland
-- location has its own Instagram (cerebral.westhighland) that posts a steady
-- stream of datable events (trivia, run club, drag brunch/bingo, fundraisers),
-- so the cerebral-west-highland-ig source in lib/ingest/sources.ts pins to this
-- row instead of mis-pinning ~3 miles away to Congress Park.
--
-- Address from cerebralbrewing.com; coords geocoded via Nominatim (rooftop on
-- 3257 Lowell Blvd). An earlier ad-hoc run of this source auto-created the row
-- via resolveOrCreateVenue() with a rough neighborhood-centroid geocode (~400m
-- off), the wrong neighborhood ("Highlands"), and no description — so this
-- upserts the precise values rather than leaving that row untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('cerebral-west-highland', 'Cerebral Brewing — West Highland', 'Cerebral Brewing''s West Highland taproom on Lowell Blvd, a 4,000 sq ft space shared with Outside Pizza, hosting trivia, run club, drag brunch, and community events.', '3257 Lowell Blvd, Denver', 'West Highland', 39.7631, -105.0350)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  address = excluded.address,
  neighborhood = excluded.neighborhood,
  lat = excluded.lat,
  lng = excluded.lng;
