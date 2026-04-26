create table public.source_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'ok', 'failed', 'skipped')),
  items_seen int not null default 0,
  items_inserted int not null default 0,
  items_updated int not null default 0,
  items_duplicate int not null default 0,
  error text,
  attempt int not null default 1
);

create index source_runs_source_idx on public.source_runs(source_id, started_at desc);

alter table public.source_runs enable row level security;
-- No policies: only service-role writes/reads. The cron orchestrator uses the service-role key.
