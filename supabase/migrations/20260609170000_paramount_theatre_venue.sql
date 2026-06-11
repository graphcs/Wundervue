-- Seed the Paramount Theatre as the venue for the paramount-theatre-web source
-- (connector: "ticketmasterVenue"), which pins every event to it via
-- defaultVenueSlug. resolveOrCreateVenue() throws on a missing slug, so this
-- must exist first.
--
-- Address from the Ticketmaster venue feed (1621 Glenarm Place); coords
-- geocoded (downtown, on the 16th Street Mall). Idempotent: re-runs leave any
-- existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('paramount-theatre', 'Paramount Theatre', 'A restored 1930 art-deco theatre on the 16th Street Mall downtown — a ~1,870-seat room hosting concerts, comedy, film, and live performance under its landmark vertical marquee.', '1621 Glenarm Place, Denver, CO 80202', 'Downtown', 39.7445, -104.9889)
on conflict (slug) do nothing;
