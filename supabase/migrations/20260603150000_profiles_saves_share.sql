-- Revocable share token for a user's full "All saves" collection.
--
-- Replaces the previous design that used the (immutable, non-revocable) auth
-- user id as the share token. A nullable slug is minted only when an Insider
-- chooses to share their saves, and clearing it instantly revokes the link.

alter table public.profiles
  add column if not exists saves_share_slug text unique;
