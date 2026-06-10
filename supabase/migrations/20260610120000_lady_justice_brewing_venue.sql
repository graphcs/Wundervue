-- Seed Lady Justice Brewing as the venue for the lady-justice-brewing-web source
-- (connector: "icsCalendar"), which pins every event to it via defaultVenueSlug.
-- resolveOrCreateVenue() throws on a missing slug, so this must exist first.
--
-- Address from the calendar's LOCATION field (3242 S Acoma St, Englewood); coords
-- geocoded. Idempotent: re-runs leave any existing row.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('lady-justice-brewing', 'Lady Justice Brewing', 'A women-owned, queer-community brewery in Englewood that channels profits into local nonprofits — host to drag and queer nights, live music, trivia, bingo, and rotating food trucks.', '3242 S Acoma St, Englewood, CO 80110', 'Englewood', 39.6486, -104.9986)
on conflict (slug) do nothing;
