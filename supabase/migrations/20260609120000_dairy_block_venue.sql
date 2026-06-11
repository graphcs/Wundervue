-- Seed Dairy Block as the fallback venue for the dairy-block-web source
-- (connector: "tribeEvents"). Most events carry their own sub-venue (Seven
-- Grand, etc.) which resolveOrCreateVenue() handles; this covers venue-less
-- events via defaultVenueSlug, which throws on a missing slug.
--
-- Address from dairyblock.com; coords geocoded (1800 Wazee St, LoDo).
-- Idempotent: re-runs leave any pre-existing row untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('dairy-block', 'Dairy Block', 'A lively LoDo micro-district between Blake and Wazee — home to The Maven Hotel, the Milk Market food hall, bars, shops, and a year-round calendar of live music, trivia, markets, and date nights.', '1800 Wazee St, Denver, CO 80202', 'Downtown', 39.7529, -104.9987)
on conflict (slug) do nothing;
