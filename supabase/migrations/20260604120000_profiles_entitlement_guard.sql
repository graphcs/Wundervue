-- Prevent privilege escalation on profiles.
--
-- RLS "profiles update own" lets a user update their own row, with no column
-- guard — so a signed-in user could set plan='insider' (or rewrite
-- stripe_customer_id) straight from the browser and unlock paid features.
-- RLS WITH CHECK can't compare against the OLD row, so enforce with a trigger:
-- only the billing webhook (service role) may change these entitlement columns.

create or replace function public.prevent_profile_entitlement_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.role() is 'service_role' only for service-role (webhook) callers.
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.plan is distinct from old.plan then
      raise exception 'plan can only be changed by the billing service';
    end if;
    if new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'stripe_customer_id can only be changed by the billing service';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_entitlement_change on public.profiles;
create trigger profiles_prevent_entitlement_change
  before update on public.profiles
  for each row execute function public.prevent_profile_entitlement_change();
