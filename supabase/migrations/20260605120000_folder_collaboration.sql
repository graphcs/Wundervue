-- Folder collaborative editing (Insider).
--
-- Until now a folder's contents were the OWNER's favorites rows tagged with
-- favorites.folder_id (owner-only RLS), so no one but the owner could edit them.
-- Collaboration needs folder membership decoupled from personal saves:
--
--   * folder_items        — the listings in a folder (editable by owner + collaborators)
--   * folder_collaborators — who, besides the owner, may edit a folder
--
-- Owners and collaborators add/remove via folder_items under RLS. The public
-- /folders/[share_slug] view still reads through the service role, so logged-out
-- viewers stay read-only. Collaboration is Insider-only (enforced at join time).

-- Folder membership (one row per listing in a folder).
create table if not exists public.folder_items (
  folder_id uuid not null references public.saved_folders(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (folder_id, listing_id)
);
create index if not exists folder_items_folder_idx on public.folder_items(folder_id);

-- Collaborators who may edit a folder (the owner is implicit, not listed here).
create table if not exists public.folder_collaborators (
  folder_id uuid not null references public.saved_folders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);
create index if not exists folder_collaborators_user_idx on public.folder_collaborators(user_id);

-- Owner-or-collaborator check. SECURITY DEFINER so it bypasses the RLS on the
-- tables it reads (avoids cross-table RLS visibility puzzles + recursion).
create or replace function public.can_edit_folder(fid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.saved_folders f where f.id = fid and f.user_id = auth.uid())
      or exists (select 1 from public.folder_collaborators c where c.folder_id = fid and c.user_id = auth.uid());
$$;
revoke all on function public.can_edit_folder(uuid) from public;
grant execute on function public.can_edit_folder(uuid) to authenticated;

-- Backfill existing folder contents from the legacy favorites.folder_id model.
insert into public.folder_items (folder_id, listing_id, added_by)
select folder_id, listing_id, user_id
from public.favorites
where folder_id is not null
on conflict (folder_id, listing_id) do nothing;

alter table public.folder_items enable row level security;
create policy "folder_items editor select" on public.folder_items for select using (public.can_edit_folder(folder_id));
create policy "folder_items editor insert" on public.folder_items for insert with check (public.can_edit_folder(folder_id));
create policy "folder_items editor delete" on public.folder_items for delete using (public.can_edit_folder(folder_id));

alter table public.folder_collaborators enable row level security;
-- Owner + collaborators can see the collaborator list.
create policy "folder_collaborators select" on public.folder_collaborators for select using (public.can_edit_folder(folder_id));
-- A user may leave (delete own row); the owner may remove anyone. Joining goes
-- through the service-role /api/folders/join route, so there is no client insert.
create policy "folder_collaborators delete" on public.folder_collaborators for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.saved_folders f where f.id = folder_id and f.user_id = auth.uid())
);
