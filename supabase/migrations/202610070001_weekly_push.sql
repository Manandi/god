-- Opt-in weekly quest push reminders. Apply after the existing shared schema.
create table if not exists public.weekly_push_subscriptions (
  endpoint text primary key,
  hunter_id uuid not null,
  p256dh text not null,
  auth text not null,
  timezone text not null,
  week_start date not null,
  weekly_complete boolean not null default false,
  last_sent_local_date date,
  updated_at timestamptz not null default now()
);
create index if not exists weekly_push_due on public.weekly_push_subscriptions (week_start, weekly_complete, timezone);
alter table public.weekly_push_subscriptions enable row level security;
revoke all on public.weekly_push_subscriptions from anon, authenticated;

create or replace function public.save_weekly_push_subscription(
  p_id uuid, p_secret text, p_endpoint text, p_p256dh text, p_auth text,
  p_week_start date, p_complete boolean, p_timezone text
)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare old_owner uuid;
begin
  if not public.hunter_secret_ok(p_id, p_secret) then raise exception 'not your hunter'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 2048
     or p_p256dh is null or char_length(p_p256dh) > 200
     or p_auth is null or char_length(p_auth) > 100 then raise exception 'bad push subscription'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 4 then raise exception 'bad challenge week'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'bad timezone'; end if;
  select hunter_id into old_owner from public.weekly_push_subscriptions where endpoint = p_endpoint;
  insert into public.weekly_push_subscriptions(endpoint,hunter_id,p256dh,auth,timezone,week_start,weekly_complete,last_sent_local_date,updated_at)
  values(p_endpoint,p_id,p_p256dh,p_auth,p_timezone,p_week_start,coalesce(p_complete,false),null,now())
  on conflict(endpoint) do update set
    hunter_id=excluded.hunter_id,p256dh=excluded.p256dh,auth=excluded.auth,timezone=excluded.timezone,
    week_start=excluded.week_start,weekly_complete=excluded.weekly_complete,
    last_sent_local_date=case when old_owner=excluded.hunter_id then public.weekly_push_subscriptions.last_sent_local_date else null end,
    updated_at=now();
end;$$;

create or replace function public.update_weekly_push_state(
  p_id uuid, p_secret text, p_week_start date, p_complete boolean, p_timezone text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.hunter_secret_ok(p_id, p_secret) then raise exception 'not your hunter'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 4 then raise exception 'bad challenge week'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'bad timezone'; end if;
  update public.weekly_push_subscriptions
    set week_start=p_week_start,weekly_complete=coalesce(p_complete,false),timezone=p_timezone,updated_at=now()
    where hunter_id=p_id;
end;$$;

create or replace function public.remove_weekly_push_subscription(p_id uuid,p_secret text,p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.hunter_secret_ok(p_id, p_secret) then raise exception 'not your hunter'; end if;
  delete from public.weekly_push_subscriptions where hunter_id=p_id and endpoint=p_endpoint;
end;$$;

revoke all on function public.save_weekly_push_subscription(uuid,text,text,text,text,date,boolean,text) from public;
revoke all on function public.update_weekly_push_state(uuid,text,date,boolean,text) from public;
revoke all on function public.remove_weekly_push_subscription(uuid,text,text) from public;
grant execute on function public.save_weekly_push_subscription(uuid,text,text,text,text,date,boolean,text) to anon, authenticated;
grant execute on function public.update_weekly_push_state(uuid,text,date,boolean,text) to anon, authenticated;
grant execute on function public.remove_weekly_push_subscription(uuid,text,text) to anon, authenticated;
