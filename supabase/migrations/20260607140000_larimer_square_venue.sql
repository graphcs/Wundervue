-- Seed Larimer Square as a venue for the larimer-square-web source
-- (connector: "squarespaceEvents"), which pins each event here via
-- defaultVenueSlug. resolveOrCreateVenue() throws on a missing slug, so this
-- must exist before the source runs.
--
-- Address from larimersquare.com; coords geocoded (1430 Larimer St, LoDo).
-- Idempotent: re-runs leave any pre-existing row untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('larimer-square', 'Larimer Square', 'Denver''s oldest and most historic block in LoDo — a string of Victorian-era buildings housing acclaimed restaurants, bars, and boutiques, with a year-round calendar of drag brunches, run clubs, markets, and seasonal celebrations.', '1430 Larimer St, Denver, CO 80202', 'Downtown', 39.7479, -104.9992)
on conflict (slug) do nothing;
