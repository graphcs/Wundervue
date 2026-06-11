-- The Empourium Brewing Company already exists as a venue (auto-created from the
-- Pottery With A Purpose product title), but with a vague address and no coords.
-- The empourium-brewing-web events source pins to it via defaultVenueSlug, so
-- give it a real address + geocoded coords. `do update` so it repairs the
-- existing row (the other seeds use `do nothing` for brand-new venues).
insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('the-empourium-brewing-company', 'The Empourium Brewing Company', 'A Berkeley-neighborhood brewery and event space in northwest Denver — live music, trivia, drag bingo, comedy, pottery nights, and rotating food trucks.', '4385 W 42nd Ave, Denver, CO 80212', 'Berkeley', 39.7716, -105.0405)
on conflict (slug) do update set
  address = excluded.address,
  neighborhood = excluded.neighborhood,
  lat = excluded.lat,
  lng = excluded.lng,
  description = excluded.description;
