-- Seed the two Denver Botanic Gardens locations for the
-- denver-botanic-gardens-web source (connector: "botanicGardensCalendar").
-- The connector maps each event's location badge to one of these by name, so
-- they're seeded with correct neighborhoods/coords to avoid geocoder drift.
-- Idempotent: re-runs leave any pre-existing row untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('denver-botanic-gardens', 'Denver Botanic Gardens', 'A 24-acre urban oasis in Denver''s Congress Park neighborhood — themed gardens, a conservatory, summer concerts, art exhibitions, yoga, and year-round classes and family programs.', '1007 York St, Denver, CO 80206', 'Congress Park', 39.7320, -104.9609),
  ('denver-botanic-gardens-chatfield-farms', 'Denver Botanic Gardens Chatfield Farms', 'A 700-acre native-plant refuge and working farm in Littleton — nature trails, a historic homestead, festivals, the fall corn maze, and seasonal markets.', '8500 W Deer Creek Canyon Rd, Littleton, CO 80128', 'Littleton', 39.5483, -105.1030)
on conflict (slug) do nothing;
