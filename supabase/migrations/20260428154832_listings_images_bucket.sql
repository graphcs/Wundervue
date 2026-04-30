-- Public bucket for listing card images. Service role uploads from the ingest
-- pipeline; anonymous browsers read directly via the public CDN URL. We
-- mirror every image (scraped + AI-generated) here so cards never go dark
-- when an upstream signed URL expires (Instagram, DALL·E-style providers)
-- or a venue site goes offline.

insert into storage.buckets (id, name, public)
values ('listings-images', 'listings-images', true)
on conflict (id) do nothing;

-- Anyone can read; the bucket is public-read on purpose. Service role bypasses
-- RLS for writes so no insert/update/delete policies are needed for ingest.
create policy "listings-images public read"
  on storage.objects for select
  using (bucket_id = 'listings-images');
