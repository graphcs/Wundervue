create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  address text not null default '',
  neighborhood text not null default '',
  image_url text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

alter table public.venues enable row level security;

create policy "venues read all"
  on public.venues for select
  using (true);

insert into public.venues (slug, name, description, address, neighborhood, lat, lng) values
  ('mission-ballroom', 'The Mission Ballroom', 'Denver''s premier 4,000-capacity concert venue in the RiNo Art District, featuring state-of-the-art sound and a moving floor.', '4500 National Western Dr, Denver', 'RiNo', 39.775, -104.964),
  ('lola-coastal-mexican', 'Lola Coastal Mexican', 'Vibrant coastal Mexican restaurant in LoHi serving creative tacos, ceviches, and craft margaritas.', '1575 Boulder St, Denver', 'LoHi', 39.76, -105.009),
  ('highlands-farmers-market', 'Highlands Farmers'' Market', 'Seasonal open-air market featuring 40+ local vendors with fresh produce, artisan goods, and live music.', '32nd Ave & Lowell Blvd, Denver', 'Highlands', 39.762, -105.037),
  ('north-table-mountain', 'North Table Mountain', 'Popular hiking destination in Golden with panoramic views of the Front Range and Denver metro area.', 'North Table Mountain Trailhead, Golden', 'Golden', 39.789, -105.226),
  ('great-divide-brewing', 'Great Divide Brewing', 'Award-winning craft brewery with a taproom and patio, known for their Yeti Imperial Stout and seasonal releases.', '2201 Arapahoe St, Denver', 'Cherry Creek', 39.751, -104.989),
  ('santa-fe-art-district', 'Santa Fe Art District', 'Denver''s creative heart — home to 30+ galleries, studios, and creative spaces along Santa Fe Drive.', 'Santa Fe Dr & 10th Ave, Denver', 'Downtown', 39.732, -104.999),
  ('little-man-ice-cream', 'Little Man Ice Cream', 'Iconic LoHi creamery housed in a giant cream can, serving handcrafted ice cream and fresh pastries.', '2620 16th St, Denver', 'LoHi', 39.758, -105.011),
  ('the-squire-lounge', 'The Squire Lounge', 'Beloved Capitol Hill dive bar and comedy venue with a laid-back atmosphere and strong drinks.', '916 Broadway, Denver', 'Capitol Hill', 39.734, -104.987),
  ('wash-park-brewing', 'Wash Park Brewing', 'Neighborhood brewery near Wash Park with a dog-friendly patio and rotating tap list.', '1079 S Broadway, Denver', 'Wash Park', 39.7, -104.987),
  ('civic-center-park', 'Civic Center Park', 'Downtown Denver''s central green space hosting free community events, farmers markets, and outdoor fitness.', '101 W 14th Ave, Denver', 'Downtown', 39.738, -104.991),
  ('snooze-eatery', 'Snooze Eatery', 'Popular brunch spot in the Highlands known for creative pancake flights and eggs Benedict variations.', '3825 W 32nd Ave, Denver', 'Highlands', 39.763, -105.035),
  ('rino-art-district', 'RiNo Art District', 'Denver''s trendiest neighborhood filled with street art, galleries, breweries, and creative pop-up events.', '3501 Wazee St, Denver', 'RiNo', 39.77, -104.983);
