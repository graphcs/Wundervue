-- Notifications feature: in-app inbox feed + per-user prefs + cron watermarks.
-- v1 is inbox-only (no email/push yet). Cron jobs write rows via the service
-- role; users read/manage only their own.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  url text,
  listing_id uuid references public.listings(id) on delete set null,
  data jsonb,
  -- One row per (user, logical event); a unique index makes cron retries idempotent.
  dedup_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;
create unique index if not exists notifications_dedup_idx
  on public.notifications (user_id, dedup_key);

alter table public.notifications enable row level security;
-- Owner read / mark-read / dismiss. No insert policy: only the service role
-- (cron) writes, which bypasses RLS.
create policy "notifications select own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications update own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications delete own" on public.notifications
  for delete using (auth.uid() = user_id);

-- Per-user notification preferences (type -> bool). Re-added after PR3 dropped
-- its earlier version; advanced keys are gated to Insider in app code.
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

-- Per-job watermark so time-windowed jobs only consider rows newer than the
-- last successful run.
create table if not exists public.notification_job_state (
  job text primary key,
  last_run_at timestamptz not null default now()
);
