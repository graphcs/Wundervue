-- Schoolyard Beer Garden already exists as a venue (auto-created from the Pottery
-- With A Purpose product title) with a vague "Denver, CO" address and an
-- approximate geocode. The schoolyard-beer-garden-web events source pins to it via
-- defaultVenueSlug, so give it a real Golden Triangle address + coords. `do update`
-- repairs the existing row (most seeds use `do nothing` for brand-new venues).
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('schoolyard-beer-garden-and-cafe', 'Schoolyard Beer Garden and Cafe', 'A Golden Triangle beer garden and cafe with trivia, pop-up markets, book club, pottery nights, and seasonal events.', '1115 Acoma St, Denver, CO 80204', 'Golden Triangle', 39.7341, -104.9905)
on conflict (slug) do update set
  address = excluded.address,
  neighborhood = excluded.neighborhood,
  lat = excluded.lat,
  lng = excluded.lng,
  description = excluded.description;
