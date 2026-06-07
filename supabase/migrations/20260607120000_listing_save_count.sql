-- Social proof: a denormalized save_count on each listing, maintained by a
-- trigger on favorites. favorites is owner-only under RLS, so a public client
-- can't aggregate it directly — this column rides along with the public listing
-- read instead. Backfilled from existing favorites.

alter table public.listings add column if not exists save_count integer not null default 0;

update public.listings l
set save_count = c.n
from (select listing_id, count(*)::int n from public.favorites group by listing_id) c
where c.listing_id = l.id;

-- SECURITY DEFINER so a favoriting user (who can't UPDATE listings) still
-- updates the counter via the trigger.
create or replace function public.bump_listing_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.listings set save_count = save_count + 1 where id = new.listing_id;
  elsif (tg_op = 'DELETE') then
    update public.listings set save_count = greatest(save_count - 1, 0) where id = old.listing_id;
  end if;
  return null;
end;
$$;

drop trigger if exists favorites_save_count on public.favorites;
create trigger favorites_save_count
  after insert or delete on public.favorites
  for each row execute function public.bump_listing_save_count();
