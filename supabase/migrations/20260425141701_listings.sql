create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null check (type in ('event', 'deal', 'both')),
  title text not null,
  description text not null default '',
  venue_id uuid references public.venues(id) on delete set null,
  address text,
  neighborhood text,
  category text,
  date_start timestamptz,
  date_end timestamptz,
  date_display text,
  time_display text,
  is_free boolean not null default false,
  deal_value text,
  image_url text,
  source text not null,
  source_url text,
  source_id text not null,
  event_key text not null,
  dedup_of uuid references public.listings(id) on delete set null,
  tags text[] not null default '{}',
  lat double precision,
  lng double precision,
  published_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index listings_event_key_idx on public.listings(event_key);
create index listings_published_idx on public.listings(published_at) where published_at is not null;
create index listings_venue_idx on public.listings(venue_id);
create index listings_date_start_idx on public.listings(date_start) where published_at is not null;

alter table public.listings enable row level security;

create policy "listings read published"
  on public.listings for select
  using (published_at is not null);

create or replace function public.handle_listings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.handle_listings_updated_at();
