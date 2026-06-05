-- Calendar Sync: a per-user secret token for the .ics subscription feed
-- (served unauthenticated by token at /api/calendar/<token>; minted Insider-only).
alter table public.profiles
  add column if not exists calendar_token text unique;
