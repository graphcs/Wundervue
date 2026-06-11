-- Seed The Jasmine Bar as the venue for the jasmine-bar-web source
-- (connector: "squarespaceEvents"), which pins every event to it via
-- defaultVenueSlug. resolveOrCreateVenue() throws on a missing slug.
-- Downtown Louisville; address + coords from the Squarespace location (its
-- markerLat was bogusly in NYC, so use the mapLat). Idempotent.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('the-jasmine-bar', 'The Jasmine Bar', 'A wine and cocktail bar in downtown Louisville with a courtyard that hosts a free summer concert series — live music on Friday and Saturday nights.', '836 1/2 Main St, Louisville, CO 80027', 'Downtown Louisville', 39.978414, -105.131836)
on conflict (slug) do nothing;
