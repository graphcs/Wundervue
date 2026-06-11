-- Seed Elitch Gardens as the venue for the elitch-gardens-web source
-- (connector: "cheerioWeb"), which pins every event to it via defaultVenueSlug.
-- resolveOrCreateVenue() throws on a missing slug, so this must exist first.
--
-- Address from the park (2000 Elitch Cir — Central Platte Valley / Sun Valley,
-- beside downtown); coords geocoded. Idempotent: re-runs leave any existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('elitch-gardens', 'Elitch Gardens Theme & Water Park', 'Denver''s downtown theme and water park beside the South Platte — roller coasters, a water park, and marquee seasonal events like Fiesta de Elitch, Glowtopia, and Fright Fest.', '2000 Elitch Cir, Denver, CO 80204', 'Sun Valley', 39.7497, -105.0089)
on conflict (slug) do nothing;
