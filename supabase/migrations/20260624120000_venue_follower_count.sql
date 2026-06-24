-- Popularity signal: a denormalized follower_count on each venue, maintained by
-- a trigger on venue_follows. venue_follows is owner-only under RLS, so a public
-- client can't aggregate it directly — this column rides along with the public
-- venue read instead (powers the "Most followed" sort). Backfilled from existing
-- follows. venue_follows keys by venue_slug, so the trigger joins on venues.slug.

alter table public.venues add column if not exists follower_count integer not null default 0;

update public.venues v
set follower_count = c.n
from (select venue_slug, count(*)::int n from public.venue_follows group by venue_slug) c
where c.venue_slug = v.slug;

-- SECURITY DEFINER so a following user (who can't UPDATE venues) still updates
-- the counter via the trigger.
create or replace function public.bump_venue_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.venues set follower_count = follower_count + 1 where slug = new.venue_slug;
  elsif (tg_op = 'DELETE') then
    update public.venues set follower_count = greatest(follower_count - 1, 0) where slug = old.venue_slug;
  end if;
  return null;
end;
$$;

drop trigger if exists venue_follows_follower_count on public.venue_follows;
create trigger venue_follows_follower_count
  after insert or delete on public.venue_follows
  for each row execute function public.bump_venue_follower_count();
