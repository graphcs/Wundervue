-- Server-backed favorites + venue follows (replacing localStorage).
--
-- NOTE: these tables already existed on the production database (created by an
-- earlier migration that was never committed to this repo — see the migration
-- history drift flagged during setup). The shapes below are reconciled to match
-- production: favorites keys by listing uuid (+ optional folder_id for saved
-- folders), and venue_follows keys by venue *slug*. `if not exists` keeps this
-- a no-op against prod while making a fresh database match. RLS scopes every
-- row to its owner.

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null,
  folder_id uuid,
  saved_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.venue_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_slug)
);

create index if not exists favorites_user_idx on public.favorites(user_id);
create index if not exists favorites_folder_idx on public.favorites(folder_id) where folder_id is not null;
create index if not exists venue_follows_user_idx on public.venue_follows(user_id);

alter table public.favorites enable row level security;
alter table public.venue_follows enable row level security;

create policy "favorites owner read"   on public.favorites for select using (auth.uid() = user_id);
create policy "favorites owner insert" on public.favorites for insert with check (auth.uid() = user_id);
-- UPDATE policy is required: the app reassigns favorites.folder_id (folder
-- assignment + folder-delete detach). Without it, RLS denies those updates.
create policy "favorites owner update" on public.favorites for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorites owner delete" on public.favorites for delete using (auth.uid() = user_id);

create policy "venue_follows owner read"   on public.venue_follows for select using (auth.uid() = user_id);
create policy "venue_follows owner insert" on public.venue_follows for insert with check (auth.uid() = user_id);
create policy "venue_follows owner delete" on public.venue_follows for delete using (auth.uid() = user_id);
