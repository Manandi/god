-- The Hollow Roots · shared leaderboard (3D game)
--
-- Applied to the `hollow-roots` Supabase project as the migration
-- `hunters_leaderboard`. To set up a new project, run this whole file in the
-- SQL editor; no auth settings are needed.
--
-- Each browser makes a random id and a random secret (first-person-verdant/
-- src/leaderboard.js). Anyone can read the board; a row can only be written
-- through submit_hunter()/remove_hunter() by whoever holds its secret, and the
-- secret itself (stored only as a SHA-256 hash) is never readable.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.hunters (
  id uuid primary key,
  secret_hash text not null,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  level int not null default 1 check (level between 1 and 999),
  xp int not null default 0 check (xp between 0 and 10000000),
  klass text not null default 'fighter' check (klass in ('fighter', 'tank', 'ranger', 'mage', 'support')),
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hunters enable row level security;

-- Readable by everyone, but only these columns (never secret_hash).
revoke all on public.hunters from anon, authenticated;
grant select (id, name, level, xp, klass, stats, updated_at) on public.hunters to anon, authenticated;
drop policy if exists "hunters are public" on public.hunters;
create policy "hunters are public" on public.hunters for select to anon, authenticated using (true);

create or replace function public.submit_hunter(p_id uuid, p_secret text, p_name text, p_level int, p_xp int, p_klass text, p_stats jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
  clean jsonb := '{}'::jsonb;
  k text;
begin
  if p_secret is null or char_length(p_secret) < 20 then raise exception 'bad secret'; end if;
  -- Keep only the six stats, as whole numbers 1–30.
  foreach k in array array['strength', 'speed', 'stamina', 'defense', 'intelligence', 'discipline'] loop
    if jsonb_typeof(p_stats -> k) = 'number' then
      clean := clean || jsonb_build_object(k, greatest(1, least(30, round((p_stats ->> k)::numeric)::int)));
    end if;
  end loop;
  insert into public.hunters (id, secret_hash, name, level, xp, klass, stats, updated_at)
  values (p_id, h, left(btrim(p_name), 24), p_level, p_xp, p_klass, clean, now())
  on conflict (id) do update
    set name = excluded.name, level = excluded.level, xp = excluded.xp, klass = excluded.klass, stats = excluded.stats, updated_at = now()
    where public.hunters.secret_hash = h;
end;
$$;

create or replace function public.remove_hunter(p_id uuid, p_secret text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.hunters where id = p_id and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
$$;

revoke all on function public.submit_hunter(uuid, text, text, int, int, text, jsonb) from public;
revoke all on function public.remove_hunter(uuid, text) from public;
grant execute on function public.submit_hunter(uuid, text, text, int, int, text, jsonb) to anon, authenticated;
grant execute on function public.remove_hunter(uuid, text) to anon, authenticated;

-- One asynchronous weekly world, with personal quest saves. The browser-held
-- hunter secret protects each personal row; the public weekly row contains
-- only the shared boss result. Re-running this section is safe.
create table if not exists public.weekly_hunters (
  week_id text not null,
  hunter_id uuid not null,
  secret_hash text not null,
  profile jsonb not null default '{}'::jsonb,
  world jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (week_id,hunter_id)
);
alter table public.weekly_hunters enable row level security;
revoke all on public.weekly_hunters from anon,authenticated;

create table if not exists public.weekly_worlds (
  week_id text primary key,
  boss_defeated boolean not null default false,
  defeated_at timestamptz
);
alter table public.weekly_worlds enable row level security;
grant select (week_id,boss_defeated,defeated_at) on public.weekly_worlds to anon,authenticated;
drop policy if exists "weekly world is public" on public.weekly_worlds;
create policy "weekly world is public" on public.weekly_worlds for select to anon,authenticated using (true);

-- Personal progress carries over between weeks: this returns the hunter's most
-- recent save (this week's if there is one), and the browser keeps whichever of
-- the cloud and local copies is newer (world.savedAt).
create or replace function public.load_weekly_hunter(p_week text,p_id uuid,p_secret text)
returns jsonb language sql security definer set search_path=public,extensions as $$
  select jsonb_build_object('profile',profile,'world',world,'week',week_id) from public.weekly_hunters
  where hunter_id=p_id and secret_hash=encode(extensions.digest(p_secret,'sha256'),'hex')
  order by (week_id=left(p_week,16)) desc, updated_at desc limit 1;
$$;
create or replace function public.save_weekly_hunter(p_week text,p_id uuid,p_secret text,p_profile jsonb,p_world jsonb)
returns void language plpgsql security definer set search_path=public,extensions as $$
declare h text:=encode(extensions.digest(p_secret,'sha256'),'hex');
begin
  if p_secret is null or char_length(p_secret)<20 then raise exception 'bad secret'; end if;
  if octet_length(coalesce(p_profile,'{}')::text)+octet_length(coalesce(p_world,'{}')::text)>200000 then raise exception 'save too large'; end if;
  insert into public.weekly_hunters(week_id,hunter_id,secret_hash,profile,world,updated_at)
  values(left(p_week,16),p_id,h,coalesce(p_profile,'{}'),coalesce(p_world,'{}'),now())
  on conflict(week_id,hunter_id) do update set profile=excluded.profile,world=excluded.world,updated_at=now()
  where public.weekly_hunters.secret_hash=h;
end;$$;
create or replace function public.defeat_weekly_boss(p_week text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if extract(dow from now() at time zone 'UTC') not in (0,6) then raise exception 'boss is sealed until the weekend'; end if;
  -- Only this week can be marked (the browser's Monday may be a day either side of UTC's).
  if p_week is null or p_week !~ '^\d{4}-\d{2}-\d{2}$'
     or abs(p_week::date - date_trunc('week', now() at time zone 'UTC')::date) > 1 then
    raise exception 'not this week';
  end if;
  insert into public.weekly_worlds(week_id,boss_defeated,defeated_at) values(left(p_week,16),true,now())
  on conflict(week_id) do update set boss_defeated=true,defeated_at=coalesce(public.weekly_worlds.defeated_at,now());
end;$$;
revoke all on function public.load_weekly_hunter(text,uuid,text) from public;
revoke all on function public.save_weekly_hunter(text,uuid,text,jsonb,jsonb) from public;
revoke all on function public.defeat_weekly_boss(text) from public;
grant execute on function public.load_weekly_hunter(text,uuid,text) to anon,authenticated;
grant execute on function public.save_weekly_hunter(text,uuid,text,jsonb,jsonb) to anon,authenticated;
grant execute on function public.defeat_weekly_boss(text) to anon,authenticated;

