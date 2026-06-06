-- Public submissions: community event/deal submissions + partner inquiries.
-- Anyone (logged in or not) can submit; rows are write-only from the client and
-- reviewed out of band. The API routes insert via the service role, but the
-- public insert policy keeps the tables usable if that changes. No client
-- select/update/delete.

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'event' check (kind in ('event', 'deal')),
  title text not null,
  description text,
  venue_name text,
  neighborhood text,
  url text,
  event_date text, -- free-text date/time as submitted
  submitter_name text,
  submitter_email text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists submissions_status_idx on public.submissions(status);

alter table public.submissions enable row level security;
create policy "submissions insert any" on public.submissions for insert with check (true);

create table if not exists public.partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_type text not null default 'partnership'
    check (inquiry_type in ('partnership', 'advertise', 'media', 'other')),
  name text not null,
  email text not null,
  company text,
  message text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists partner_inquiries_status_idx on public.partner_inquiries(status);

alter table public.partner_inquiries enable row level security;
create policy "partner_inquiries insert any" on public.partner_inquiries for insert with check (true);
