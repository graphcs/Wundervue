-- Seed New Terrain Brewing Co as the venue for the new-terrain-brewing-web source
-- (connector: "squarespaceEvents"), which pins every event to it via
-- defaultVenueSlug. resolveOrCreateVenue() throws on a missing slug, so this
-- must exist first.
--
-- Address + coords from the Squarespace event location data (16401 Table
-- Mountain Pkwy, Golden — northwest Denver metro). Idempotent: re-runs leave any
-- existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('new-terrain-brewing', 'New Terrain Brewing Co', 'A foothills brewery in Golden with a big patio and mesa views — host to live music (Music by the Mesa), World Cup watch parties, yoga, bike demo days, and book clubs.', '16401 Table Mountain Pkwy, Golden, CO 80403', 'Golden', 39.77959, -105.18597)
on conflict (slug) do nothing;
