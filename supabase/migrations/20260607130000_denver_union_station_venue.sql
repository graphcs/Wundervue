-- Seed Denver Union Station as a venue for the denver-union-station-web source
-- (connector: "denverUnionStation"), which scrapes the station's events sitemap
-- and pins each event here via defaultVenueSlug. resolveOrCreateVenue() throws
-- on a missing slug, so this must exist before the source runs.
--
-- Address from denverunionstation.com; coords geocoded (1701 Wynkoop St, LoDo).
-- Idempotent: re-runs leave any pre-existing row untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('denver-union-station', 'Denver Union Station', 'Historic 1881 transit hall and gathering place in LoDo — home to The Crawford Hotel, restaurants, and bars, with a year-round calendar of urban markets, festivals, tastings, and community events.', '1701 Wynkoop St, Denver, CO 80202', 'Downtown', 39.7532277, -105.0000944)
on conflict (slug) do nothing;
