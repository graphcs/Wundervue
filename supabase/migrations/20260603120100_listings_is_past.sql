-- Soft-expire past listings instead of deleting them.
--
-- The main explore feed already hides past events via its `date_start >= today`
-- filter, and detail-page lookups only require `published_at is not null`. By
-- flagging instead of deleting, a user's previously-saved event/deal still
-- resolves on its detail page and can power the "Past Saved" tab + venue
-- archives, while the row (and its image) is preserved.

alter table public.listings
  add column if not exists is_past boolean not null default false;

create index if not exists listings_is_past_idx on public.listings(is_past) where is_past = true;
