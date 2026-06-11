-- Seed Denver Comedy Underground as the venue for the
-- denver-comedy-underground-web source (connector: "cheerioWeb"), which pins
-- every event to it via defaultVenueSlug. resolveOrCreateVenue() throws on a
-- missing slug, so this must exist first.
--
-- Address from the page's schema.org Place data (675 22nd St — Five Points);
-- coords geocoded. Idempotent: re-runs leave any existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('denver-comedy-underground', 'Denver Comedy Underground', 'An intimate Five Points comedy club with nightly stand-up showcases, headliner sets, open mics, and late-night shows.', '675 22nd St, Denver, CO 80205', 'Five Points', 39.7556, -104.9838)
on conflict (slug) do nothing;
