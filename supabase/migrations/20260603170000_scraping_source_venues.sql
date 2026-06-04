-- Seed canonical venue rows for the new scraping data sources that map to a
-- single physical place. Sources in lib/ingest/sources.ts reference these via
-- defaultVenueSlug; resolveOrCreateVenue() throws if the slug is missing, so
-- these must exist before those sources run.
--
-- Idempotent: `on conflict (slug) do nothing` leaves any pre-existing rows
-- (highlands-farmers-market, rino-art-district from the original seed) and
-- re-runs untouched. Sports teams pin to their home venue (Coors Field,
-- Empower Field, Ball Arena), so no separate team venues are created.
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('red-rocks-amphitheatre', 'Red Rocks Park & Amphitheatre', 'Iconic open-air amphitheatre carved into the foothills, hosting world-class concerts and events against a backdrop of towering red sandstone.', '18300 W Alameda Pkwy, Morrison', 'Morrison', 39.6655, -105.2056),
  ('levitt-pavilion-denver', 'Levitt Pavilion Denver', 'Outdoor music venue in Ruby Hill Park offering dozens of free concerts each summer alongside ticketed headline shows.', '1380 W Florida Ave, Denver', 'Ruby Hill', 39.6839, -105.0086),
  ('denver-beer-co', 'Denver Beer Co', 'Family- and dog-friendly craft brewery in LoHi with a large patio, rotating seasonal taps, and frequent community events.', '1695 Platte St, Denver', 'LoHi', 39.7615, -105.0078),
  ('denver-museum-nature-science', 'Denver Museum of Nature & Science', 'Premier natural history museum on the edge of City Park, featuring rotating exhibitions, an IMAX theater, and planetarium shows.', '2001 Colorado Blvd, Denver', 'City Park', 39.7475, -104.9426),
  ('little-blue-pigeon', 'Little Blue Pigeon', 'Independent neighborhood bookshop hosting author readings, story times, and community literary events.', 'Denver, CO', '', null, null),
  ('ball-arena', 'Ball Arena', 'Downtown Denver''s premier indoor arena and home of the Nuggets and Avalanche, also hosting major concerts and live events.', '1000 Chopper Cir, Denver', 'Downtown', 39.7487, -105.0077),
  ('cerebral-brewing', 'Cerebral Brewing', 'Congress Park craft brewery known for inventive hoppy and barrel-aged beers, with a lively taproom and regular events.', '1477 Monroe St, Denver', 'Congress Park', 39.7363, -104.9550),
  ('coors-field', 'Coors Field', 'Home of the Colorado Rockies in LoDo — a classic open-air ballpark hosting MLB games and special events all season.', '2001 Blake St, Denver', 'LoDo', 39.7559, -104.9942),
  ('empower-field', 'Empower Field at Mile High', 'Home of the Denver Broncos in Sun Valley, hosting NFL games, major concerts, and large-scale events.', '1701 Bryant St, Denver', 'Sun Valley', 39.7439, -105.0201),
  -- Highlands Square is a walkable shopping/dining district, not a single
  -- address; its website's flagship events (Street Fair, Oktoberfest, etc.) all
  -- happen here, so the highlands-square-web source pins to this canonical row.
  ('highlands-square', 'Highlands Square', 'Historic shopping and dining district in the Highlands hosting the Street Fair, Oktoberfest, Farmers Market, and seasonal community events.', 'W 32nd Ave & Lowell Blvd, Denver', 'Highlands', 39.7626, -105.0376)
on conflict (slug) do nothing;
