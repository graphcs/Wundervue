-- Stripe customer id is 1:1 with a user and survives cancel/resubscribe
-- cycles, so it lives on profiles. The subscriptions table below tracks each
-- subscription record (history is kept across resubscribes).
alter table public.profiles
  add column stripe_customer_id text unique;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  status text not null check (
    status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  ),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- Users may read their own subscription rows. There is no insert/update
-- policy by design: all writes happen from the Stripe webhook handler using
-- the service-role key, which bypasses RLS.
create policy "subscriptions read own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create function public.subscriptions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.subscriptions_set_updated_at();
