-- The Hollow Roots · Supabase schema (3D game)
--
-- Applied to the `hollow-roots` project as migrations. To set up a new project,
-- run this whole file in the SQL editor; no auth settings are needed.
--
-- Each browser makes a random hunter id and secret (first-person-verdant/src/
-- identity.js). Rows are only written through the functions below, by whoever
-- holds the secret; the secret itself is stored only as a SHA-256 hash.
-- The leaderboard (`hunters`, with stat caps) was removed and then brought back
-- on 2026-10-01 at the owner's request; it never holds weight or height.

create extension if not exists pgcrypto with schema extensions;

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


-- Link this device: a short one-time code that moves a hunter identity (and so
-- its cloud save) to another browser. Codes last 10 minutes and work once.
-- The table is not readable through the API.
create table if not exists public.device_links (
  code text primary key,
  hunter_id uuid not null,
  secret text not null,
  expires_at timestamptz not null
);
alter table public.device_links enable row level security;
revoke all on public.device_links from anon,authenticated;

create or replace function public.create_device_link(p_id uuid,p_secret text)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare
  h text:=encode(extensions.digest(p_secret,'sha256'),'hex');
  alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text; b bytea; i int;
begin
  if p_secret is null or char_length(p_secret)<20 then raise exception 'bad secret'; end if;
  -- Only the holder of a hunter's secret can hand that hunter on.
  if exists(select 1 from public.weekly_hunters where hunter_id=p_id and secret_hash<>h) then raise exception 'not your hunter'; end if;
  delete from public.device_links where expires_at<now() or hunter_id=p_id;
  loop
    b:=extensions.gen_random_bytes(8); c:='';
    for i in 0..7 loop c:=c||substr(alphabet,(get_byte(b,i)%32)+1,1); end loop;
    exit when not exists(select 1 from public.device_links where code=c);
  end loop;
  insert into public.device_links(code,hunter_id,secret,expires_at) values(c,p_id,p_secret,now()+interval '10 minutes');
  return c;
end;$$;

create or replace function public.claim_device_link(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.device_links;
begin
  delete from public.device_links where code=upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g')) and expires_at>now() returning * into r;
  if r.code is null then return null; end if;
  return jsonb_build_object('id',r.hunter_id,'secret',r.secret);
end;$$;

revoke all on function public.create_device_link(uuid,text) from public;
revoke all on function public.claim_device_link(text) from public;
grant execute on function public.create_device_link(uuid,text) to anon,authenticated;
grant execute on function public.claim_device_link(text) to anon,authenticated;


-- Leaderboard: name, class, level, XP and the six game stats only (never weight,
-- height or raw test numbers). Applied as migrations leaderboard_with_caps and
-- caps_survive_hiding.
create table if not exists public.hunters (
  id uuid primary key,
  secret_hash text not null,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  level int not null default 1 check (level between 1 and 999),
  xp int not null default 0 check (xp between 0 and 10000000),
  klass text not null default 'fighter' check (klass in ('fighter','tank','ranger','mage','support')),
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.hunters enable row level security;
revoke all on public.hunters from anon, authenticated;
grant select (id, name, level, xp, klass, stats, updated_at) on public.hunters to anon, authenticated;
drop policy if exists "hunters are public" on public.hunters;
create policy "hunters are public" on public.hunters for select to anon, authenticated using (true);

create or replace function public.submit_hunter(p_id uuid, p_secret text, p_name text, p_level int, p_xp int, p_klass text, p_stats jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  h text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
  clean jsonb := '{}'::jsonb;
  k text;
begin
  if p_secret is null or char_length(p_secret) < 20 then raise exception 'bad secret'; end if;
  if exists (select 1 from public.weekly_hunters where hunter_id = p_id and secret_hash <> h) then raise exception 'not your hunter'; end if;
  foreach k in array array['strength','speed','stamina','defense','intelligence','discipline'] loop
    if jsonb_typeof(p_stats -> k) = 'number' then
      clean := clean || jsonb_build_object(k, greatest(1, least(30, round((p_stats ->> k)::numeric)::int)));
    end if;
  end loop;
  insert into public.hunters (id, secret_hash, name, level, xp, klass, stats, updated_at)
  values (p_id, h, left(btrim(p_name), 24), p_level, p_xp, p_klass, clean, now())
  on conflict (id) do update
    set name = excluded.name, level = excluded.level, xp = excluded.xp, klass = excluded.klass, stats = excluded.stats, updated_at = now()
    where public.hunters.secret_hash = h;
end;$$;

create or replace function public.remove_hunter(p_id uuid, p_secret text)
returns void language sql security definer set search_path = public, extensions as $$
  delete from public.hunters where id = p_id and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
$$;

-- Caps (🧢): a player on the board marks a friend's stat as doubtful. The stat
-- counts as invalid (held at 10 in play) while any cap stands; only the player
-- who placed a cap can lift it. Caps outlive hiding from the board (no foreign
-- keys), so hiding can't be used to shake them off. Who capped what is public.
create table if not exists public.stat_caps (
  target uuid not null,
  flagger uuid not null,
  stat text not null check (stat in ('strength','speed','stamina','defense','intelligence','discipline')),
  created_at timestamptz not null default now(),
  primary key (target, flagger, stat),
  check (target <> flagger)
);
alter table public.stat_caps enable row level security;
revoke all on public.stat_caps from anon, authenticated;
grant select (target, flagger, stat, created_at) on public.stat_caps to anon, authenticated;
drop policy if exists "caps are public" on public.stat_caps;
create policy "caps are public" on public.stat_caps for select to anon, authenticated using (true);

create or replace function public.toggle_stat_cap(p_id uuid, p_secret text, p_target uuid, p_stat text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
begin
  if not exists (select 1 from public.hunters where id = p_id and secret_hash = h) then raise exception 'join the board first'; end if;
  if p_id = p_target then raise exception 'you cannot cap your own stats'; end if;
  if p_stat not in ('strength','speed','stamina','defense','intelligence','discipline') then raise exception 'unknown stat'; end if;
  if not exists (select 1 from public.hunters where id = p_target) then raise exception 'no such explorer'; end if;
  delete from public.stat_caps where target = p_target and flagger = p_id and stat = p_stat;
  if found then return false; end if;
  insert into public.stat_caps (target, flagger, stat) values (p_target, p_id, p_stat);
  return true;
end;$$;

revoke all on function public.submit_hunter(uuid, text, text, int, int, text, jsonb) from public;
revoke all on function public.remove_hunter(uuid, text) from public;
revoke all on function public.toggle_stat_cap(uuid, text, uuid, text) from public;
grant execute on function public.submit_hunter(uuid, text, text, int, int, text, jsonb) to anon, authenticated;
grant execute on function public.remove_hunter(uuid, text) to anon, authenticated;
grant execute on function public.toggle_stat_cap(uuid, text, uuid, text) to anon, authenticated;


-- Cosmetic lift-log titles (migration leaderboard_titles). Earned from the
-- personal lift log on the quest page; they never give XP or stats, they only
-- show under the name on the board. Unknown titles are dropped to null.
alter table public.hunters add column if not exists title text
  check (title is null or title in ('first-rep','iron-apprentice','iron-regular','iron-veteran','consistent','well-rounded','record-breaker','two-plate','three-plate'));
grant select (title) on public.hunters to anon, authenticated;

create or replace function public.submit_hunter(p_id uuid, p_secret text, p_name text, p_level int, p_xp int, p_klass text, p_stats jsonb, p_title text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  h text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
  clean jsonb := '{}'::jsonb;
  k text;
  t text := case when p_title in ('first-rep','iron-apprentice','iron-regular','iron-veteran','consistent','well-rounded','record-breaker','two-plate','three-plate') then p_title else null end;
begin
  if p_secret is null or char_length(p_secret) < 20 then raise exception 'bad secret'; end if;
  if exists (select 1 from public.weekly_hunters where hunter_id = p_id and secret_hash <> h) then raise exception 'not your hunter'; end if;
  foreach k in array array['strength','speed','stamina','defense','intelligence','discipline'] loop
    if jsonb_typeof(p_stats -> k) = 'number' then
      clean := clean || jsonb_build_object(k, greatest(1, least(30, round((p_stats ->> k)::numeric)::int)));
    end if;
  end loop;
  insert into public.hunters (id, secret_hash, name, level, xp, klass, stats, title, updated_at)
  values (p_id, h, left(btrim(p_name), 24), p_level, p_xp, p_klass, clean, t, now())
  on conflict (id) do update
    set name = excluded.name, level = excluded.level, xp = excluded.xp, klass = excluded.klass, stats = excluded.stats, title = excluded.title, updated_at = now()
    where public.hunters.secret_hash = h;
end;$$;
revoke all on function public.submit_hunter(uuid, text, text, int, int, text, jsonb, text) from public;
grant execute on function public.submit_hunter(uuid, text, text, int, int, text, jsonb, text) to anon, authenticated;
