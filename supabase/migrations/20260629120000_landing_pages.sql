-- SEO pillar / landing pages: standalone, rankable pages ("things to do in Denver
-- this weekend") with editable HTML copy ABOVE and BELOW a live, preset-filtered
-- collection of listings rendered in the middle. Authored by the team in Supabase
-- Studio (the above/below HTML is trusted raw markup, so they can add SEO copy +
-- custom code). Public read is limited to PUBLISHED rows; there is NO public write
-- policy, so edits go through the service role / Studio.

create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta_title text,
  meta_description text,
  og_image text,
  above_html text not null default '',
  below_html text not null default '',
  -- Preset filter using the feed's URL-param keys (parsed + validated by
  -- parseSearchParams) — e.g. {"date":"this-weekend","type":"events","cats":"music"}.
  -- Keys: type, date, from, to, hoods, cats, lifestyle, free, q, sort. Unknown
  -- keys / bad values are ignored. Drives the embedded collection + "See all" link.
  filter_config jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.landing_pages enable row level security;

create policy "landing_pages read published"
  on public.landing_pages for select
  using (published);

create or replace function public.handle_landing_pages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists landing_pages_updated_at on public.landing_pages;
create trigger landing_pages_updated_at
  before update on public.landing_pages
  for each row execute function public.handle_landing_pages_updated_at();
