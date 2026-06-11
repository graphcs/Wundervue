-- Seed both Comedy Works clubs for the comedy-works-web source (connector:
-- "comedyWorksCalendar"). The connector reads the venue from each show page's
-- club block ("Comedy Works Downtown" / "Comedy Works South") and sets it as
-- the item's venueName; resolveOrCreateVenue slugifies that to comedy-works-
-- downtown / comedy-works-south. Seeding both with accurate, hand-geocoded
-- coords keeps these pinned correctly instead of relying on a Nominatim lookup
-- of the name (which mislabels the South club).
--
-- Addresses from comedyworks.com show pages; coords geocoded via Nominatim.
-- Idempotent: re-runs leave any pre-existing rows untouched.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('comedy-works-downtown', 'Comedy Works Downtown', 'Intimate basement comedy club in Larimer Square hosting nationally touring stand-up comedians, with two shows most nights.', '1226 15th Street, Denver, CO 80202', 'LoDo', 39.7477661, -104.9981130),
  ('comedy-works-south', 'Comedy Works South', 'Comedy Works'' larger south-metro club at the Landmark in Greenwood Village, featuring headliners, showcases, and local comedy series.', '5345 Landmark Place, Greenwood Village, CO 80111', 'Greenwood Village', 39.6189221, -104.9013218)
on conflict (slug) do nothing;
