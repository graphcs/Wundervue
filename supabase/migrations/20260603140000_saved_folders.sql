-- Saved folders: named, shareable collections of saved listings.
--
-- A favorite is assigned to a folder via favorites.folder_id (column already
-- exists). Folders are shareable read-only via share_slug; the public
-- /folders/[share_slug] view reads through the service role on the server, so
-- RLS here can stay owner-only. Tier caps (free = 1 basic folder; advanced =
-- insider only) are enforced in the app, not the schema.

create table if not exists public.saved_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'basic' check (kind in ('basic', 'advanced')),
  share_slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at timestamptz not null default now()
);

create index if not exists saved_folders_user_idx on public.saved_folders(user_id);

alter table public.saved_folders enable row level security;

create policy "saved_folders owner read"   on public.saved_folders for select using (auth.uid() = user_id);
create policy "saved_folders owner insert" on public.saved_folders for insert with check (auth.uid() = user_id);
create policy "saved_folders owner update" on public.saved_folders for update using (auth.uid() = user_id);
create policy "saved_folders owner delete" on public.saved_folders for delete using (auth.uid() = user_id);
