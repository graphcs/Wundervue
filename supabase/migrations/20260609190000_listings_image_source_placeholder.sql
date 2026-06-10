-- Allow image_source = 'placeholder'. The image pipeline now attaches a static
-- placeholder image to an otherwise-valid event when no source image exists and
-- AI generation fails, rather than dropping the listing entirely (sources like
-- Denver Audubon have no scrapeable images, so every row relied on flaky AI gen).
alter table public.listings drop constraint if exists listings_image_source_check;
alter table public.listings
  add constraint listings_image_source_check
  check (image_source in ('existing', 'scraped', 'og-image', 'generated', 'placeholder'));
