-- Seed Avery Brewing as the venue for the avery-brewing-web source
-- (connector: "averyTaproomEvents"), which pins every event to it via
-- defaultVenueSlug. resolveOrCreateVenue() throws on a missing slug.
-- Gunbarrel, Boulder; address + coords from the taproom. Idempotent.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('avery-brewing', 'Avery Brewing Co.', 'A large Gunbarrel brewery and restaurant in Boulder with a taproom event calendar — trivia, comedy, yoga on the lawn, Magic nights, board game days, and the annual 4K on the 4th race.', '4910 Nautilus Ct N, Boulder, CO 80301', 'Gunbarrel', 40.0263, -105.2047)
on conflict (slug) do nothing;
