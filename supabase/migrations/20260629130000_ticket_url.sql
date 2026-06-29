-- Affiliate / "Buy Tickets" links. listings.ticket_url is a per-event override;
-- venues.ticket_url is a per-venue default used as the fallback at render time.
-- Both nullable: set manually in Supabase Studio (same authoring model as
-- landing_pages) or auto-seeded by ingest connectors that already carry a real
-- ticket URL. RLS already exposes all columns on both tables (listings:
-- published_at is not null; venues: read all), so no policy change is needed.

alter table public.listings add column if not exists ticket_url text;
alter table public.venues   add column if not exists ticket_url text;
