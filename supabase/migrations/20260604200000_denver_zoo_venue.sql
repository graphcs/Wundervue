-- Seed Denver Zoo as a venue for the denver-zoo-web source
-- (connector: "wpRestEvents"), which pulls the zoo's events from its WordPress
-- REST API and pins them here. resolveOrCreateVenue() throws on a missing slug,
-- so this must exist before the source runs.
--
-- Address from denverzoo.org; coords geocoded via Nominatim (rooftop).
-- Idempotent: re-runs leave any pre-existing row untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('denver-zoo', 'Denver Zoo', 'Denver Zoo Conservation Alliance in City Park — an 80-acre zoo hosting animal-birthday celebrations, Zoo Lights, Boo at the Zoo, adult nights, and seasonal family events.', '2300 Steele St, Denver', 'City Park', 39.7492, -104.9504)
on conflict (slug) do nothing;
