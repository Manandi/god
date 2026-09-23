-- The Hollow Roots · friends leaderboard
--
-- Setup, once:
--   1. Create a free project at supabase.com.
--   2. Authentication → Sign In / Providers → enable "Allow anonymous sign-ins".
--      Each browser gets its own anonymous account, which is what lets the
--      policies below stop players from editing each other's rows.
--   3. SQL Editor → paste this whole file → Run.
--   4. Project Settings → API → copy the Project URL and the anon public key
--      into .env as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.
--
-- The anon key is designed to be public; it only ever acts within these policies.

create table if not exists public.explorers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  -- Six hex characters, generated here so two players can never collide.
  friend_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  level int not null default 1 check (level between 1 and 99),
  total_stats int not null default 0 check (total_stats between 0 and 180),
  stats jsonb not null default '{}'::jsonb,
  achievements int not null default 0 check (achievements between 0 and 100),
  streak int not null default 0 check (streak between 0 and 3650),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  explorer_id uuid not null references public.explorers (id) on delete cascade,
  friend_id uuid not null references public.explorers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (explorer_id, friend_id),
  check (explorer_id <> friend_id)
);

alter table public.explorers enable row level security;
alter table public.friendships enable row level security;

-- Any signed-in player can read explorer rows: the board and friend-code
-- lookups both need to see other people's names and totals.
drop policy if exists "explorers are readable" on public.explorers;
create policy "explorers are readable" on public.explorers
  for select to authenticated using (true);

-- But each player can only create and edit their own.
drop policy if exists "explorers insert own" on public.explorers;
create policy "explorers insert own" on public.explorers
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "explorers update own" on public.explorers;
create policy "explorers update own" on public.explorers
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "friendships read own" on public.friendships;
create policy "friendships read own" on public.friendships
  for select to authenticated using (explorer_id = auth.uid());

drop policy if exists "friendships delete own" on public.friendships;
create policy "friendships delete own" on public.friendships
  for delete to authenticated using (explorer_id = auth.uid());

-- Adding a friend is mutual: entering someone's code puts each of you on the
-- other's board. The row for the other direction belongs to them, which the
-- insert policy would refuse, so this runs as the owner instead. It only ever
-- links the caller, never two arbitrary players.
create or replace function public.add_friend(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  select id into target from public.explorers where friend_code = upper(btrim(code));
  if target is null then
    raise exception 'No explorer has that code';
  end if;
  if target = auth.uid() then
    raise exception 'That is your own code';
  end if;
  insert into public.friendships (explorer_id, friend_id) values (auth.uid(), target) on conflict do nothing;
  insert into public.friendships (explorer_id, friend_id) values (target, auth.uid()) on conflict do nothing;
  return target;
end;
$$;

revoke all on function public.add_friend(text) from public, anon;
grant execute on function public.add_friend(text) to authenticated;
