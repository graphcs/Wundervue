alter table public.listings
  add column image_source text
    check (image_source in ('existing', 'scraped', 'og-image', 'generated'));
