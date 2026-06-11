-- Seed the Colorado Convention Center as the venue for the
-- colorado-convention-center-web source (connector: "cheerioWeb"), which pins
-- every event to it via defaultVenueSlug. resolveOrCreateVenue() throws on a
-- missing slug, so this must exist first.
--
-- The name matches the <ev:location> string the Denver Arts & Venues RSS feed
-- (denver-arts-venues-web) emits for CCC events, so resolveOrCreateVenue()
-- resolves those by name to this same row instead of creating a duplicate pin.
--
-- Address from denverconvention.com; coords geocoded (700 14th St, downtown —
-- the Big Blue Bear building beside the 16th St Mall). Idempotent: re-runs leave
-- any existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('colorado-convention-center', 'Colorado Convention Center', 'Denver''s 2.2-million-square-foot downtown convention center — home of the Big Blue Bear — hosting conventions, trade shows, expos, and the occasional headline concert.', '700 14th St, Denver, CO 80202', 'Downtown', 39.7434, -104.9952)
on conflict (slug) do nothing;
