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
