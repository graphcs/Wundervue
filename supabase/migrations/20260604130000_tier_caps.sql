-- Enforce tier limits at the DB layer. The client checks in useFavorites.ts /
-- useFolders.ts are UX-only; without these triggers a user could insert rows
-- directly (RLS only checks user_id) and bypass the caps. Trustworthy because
-- profiles.plan is write-protected by the entitlement-guard trigger — only the
-- Stripe webhook (service role) can change it. Service-role callers bypass.

-- Free users may save at most 10 listings; Insiders unlimited.
-- Keep the 10 in sync with FREE_LIMIT in lib/hooks/useFavorites.ts.
create or replace function public.enforce_favorites_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  cnt int;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  select plan into user_plan from public.profiles where user_id = new.user_id;
  if coalesce(user_plan, 'free') <> 'insider' then
    select count(*) into cnt from public.favorites where user_id = new.user_id;
    if cnt >= 10 then
      raise exception 'Free plan is limited to 10 saved items';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists favorites_enforce_cap on public.favorites;
create trigger favorites_enforce_cap
  before insert on public.favorites
  for each row execute function public.enforce_favorites_cap();

-- Saved folders are an Insider-only feature (mirrors FolderInsiderError).
create or replace function public.enforce_folder_insider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  select plan into user_plan from public.profiles where user_id = new.user_id;
  if coalesce(user_plan, 'free') <> 'insider' then
    raise exception 'Saved folders are an Insider feature';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_folders_enforce_insider on public.saved_folders;
create trigger saved_folders_enforce_insider
  before insert on public.saved_folders
  for each row execute function public.enforce_folder_insider();
