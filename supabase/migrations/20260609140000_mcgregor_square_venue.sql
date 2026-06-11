-- Seed McGregor Square as the venue for the mcgregor-square-web source
-- (connector: "tribeEvents"), which pins every event to it via defaultVenueSlug.
-- resolveOrCreateVenue() throws on a missing slug, so this must exist first.
--
-- Address from mcgregorsquare.com; coords geocoded (1901 Wazee St, LoDo —
-- the plaza beside Coors Field). Idempotent: re-runs leave any existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('mcgregor-square', 'McGregor Square', 'A lively LoDo plaza beside Coors Field — anchored by a giant LED screen, restaurants, and The Rally Hotel, with a year-round calendar of concerts, watch parties, markets, and outdoor movie nights.', '1901 Wazee St, Denver, CO 80202', 'Downtown', 39.7558, -104.9963)
on conflict (slug) do nothing;
