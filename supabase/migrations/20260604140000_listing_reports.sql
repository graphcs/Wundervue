-- "Report an issue" submissions on listings (wrong date/time, venue, price,
-- not happening, other). Anyone — logged in or not — can file one; rows are
-- write-only from the client and reviewed out of band. The API route inserts
-- via the service role, but the public insert policy keeps the table usable if
-- that ever changes. No client select/update/delete.
create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  issue_type text not null,
  note text,
  email text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists listing_reports_listing_idx on public.listing_reports(listing_id);
create index if not exists listing_reports_status_idx on public.listing_reports(status);

alter table public.listing_reports enable row level security;

-- Public submit: anyone can file a report.
create policy "listing_reports insert any" on public.listing_reports
  for insert with check (true);
