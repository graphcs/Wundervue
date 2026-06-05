-- Seed the Downtown Aquarium as a venue for the downtown-aquarium-web source
-- (connector: "aquariumCalendar"), which scrapes the aquarium's full-year
-- calendar.asp and pins every event here. resolveOrCreateVenue() throws on a
-- missing slug, so this must exist before the source runs.
--
-- Address from aquariumrestaurants.com; coords geocoded via Nominatim (rooftop).
-- Idempotent: re-runs leave any pre-existing row untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('downtown-aquarium', 'Downtown Aquarium', 'Million-gallon aquarium, restaurant, and event venue on the Platte River in Jefferson Park, hosting animal-awareness days, seasonal festivals, and holiday dinners under the sea.', '700 Water St, Denver', 'Jefferson Park', 39.7518, -105.0139)
on conflict (slug) do nothing;
