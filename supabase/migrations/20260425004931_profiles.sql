create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  -- keep plan values in sync with the Plan type in lib/auth/types.ts
  plan text not null default 'free' check (plan in ('free', 'insider')),
  interests text[] not null default '{}',
  neighborhoods text[] not null default '{}',
  lifestyle text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles read own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      ''
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
