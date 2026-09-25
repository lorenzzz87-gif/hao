create type public.nearby_plan as (
  id uuid,
  title text,
  activity_type text,
  starts_at timestamptz,
  venue_id uuid,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  joined_count bigint,
  max_participants integer,
  status public.plan_status,
  score double precision
);

create or replace function public.discover_nearby_plans(
  lat double precision,
  lng double precision,
  radius_m integer default 5000,
  from_ts timestamptz default now(),
  to_ts timestamptz default now() + interval '6 hours'
)
returns setof public.nearby_plan
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select
      p.id, p.title, p.activity_type, p.starts_at, p.venue_id,
      extensions.st_y(p.location::extensions.geometry) as latitude,
      extensions.st_x(p.location::extensions.geometry) as longitude,
      extensions.st_distance(p.location, extensions.st_point(lng, lat)::extensions.geography) as distance_m,
      count(pm.user_id) filter (where pm.status = 'joined') as joined_count,
      p.max_participants, p.status
    from public.plans p
    left join public.plan_members pm on pm.plan_id = p.id
    where p.status in ('open', 'confirmed', 'full')
      and auth.uid() is not null
      and lat between -90 and 90
      and lng between -180 and 180
      and radius_m between 100 and 50000
      and from_ts >= now() - interval '5 minutes'
      and to_ts > from_ts
      and to_ts <= from_ts + interval '6 hours'
      and p.starts_at between from_ts and to_ts
      and extensions.st_dwithin(p.location, extensions.st_point(lng, lat)::extensions.geography, radius_m)
      and not exists (
        select 1 from public.plan_members blocked_member
        where blocked_member.plan_id = p.id
          and blocked_member.status = 'joined'
          and private.is_blocked_pair(auth.uid(), blocked_member.user_id)
      )
      and not exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.is_suspended)
    group by p.id
  )
  select
    c.id, c.title, c.activity_type, c.starts_at, c.venue_id, c.latitude, c.longitude, c.distance_m,
    c.joined_count, c.max_participants, c.status,
    greatest(0, 1 - extract(epoch from (c.starts_at - from_ts)) / greatest(1, extract(epoch from (to_ts - from_ts)))) * 0.55
      + greatest(0, 1 - c.distance_m / radius_m) * 0.45 as score
  from candidates c
  order by score desc, starts_at asc;
$$;

create or replace function public.join_plan(target_plan_id uuid)
returns public.plan_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_plan public.plans%rowtype;
  active_count integer;
  membership public.plan_members%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select * into target_plan from public.plans where id = target_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if exists (
    select 1 from public.plan_members pm
    where pm.plan_id = target_plan_id and pm.status = 'joined'
      and private.is_blocked_pair(caller_id, pm.user_id)
  ) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  select * into membership from public.plan_members
  where plan_id = target_plan_id and user_id = caller_id and status = 'joined';
  if found then return membership; end if;

  if target_plan.status not in ('open', 'confirmed') or target_plan.starts_at <= now() then
    raise exception 'plan_not_joinable' using errcode = 'P0001';
  end if;

  select count(*) into active_count from public.plan_members where plan_id = target_plan_id and status = 'joined';
  if active_count >= target_plan.max_participants then raise exception 'plan_full' using errcode = 'P0001'; end if;

  insert into public.plan_members (plan_id, user_id, role, status, joined_at, left_at)
  values (target_plan_id, caller_id, 'member', 'joined', now(), null)
  on conflict (plan_id, user_id) do update
    set status = 'joined', joined_at = now(), left_at = null
  returning * into membership;

  active_count := active_count + 1;
  update public.plans set status = case
    when active_count >= max_participants then 'full'::public.plan_status
    when active_count >= min_participants then 'confirmed'::public.plan_status
    else 'open'::public.plan_status end
  where id = target_plan_id;

  insert into public.plan_messages (plan_id, sender_id, message_type, body)
  values (target_plan_id, caller_id, 'system', 'A participant joined.');
  if active_count = target_plan.min_participants then
    insert into public.plan_messages (plan_id, sender_id, message_type, body)
    values (target_plan_id, null, 'system', 'Plan confirmed.');
  end if;
  return membership;
end;
$$;

create or replace function public.leave_plan(target_plan_id uuid)
returns public.plan_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_plan public.plans%rowtype;
  active_count integer;
  membership public.plan_members%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into target_plan from public.plans where id = target_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if target_plan.status in ('started', 'completed', 'cancelled') then raise exception 'plan_not_leaveable' using errcode = 'P0001'; end if;

  select * into membership from public.plan_members
  where plan_id = target_plan_id and user_id = caller_id and status = 'joined';
  if not found then raise exception 'membership_not_found' using errcode = 'P0002'; end if;
  if membership.role = 'creator' then raise exception 'creator_cannot_leave' using errcode = 'P0001'; end if;

  update public.plan_members set status = 'left', left_at = now()
  where plan_id = target_plan_id and user_id = caller_id
  returning * into membership;

  select count(*) into active_count from public.plan_members where plan_id = target_plan_id and status = 'joined';
  update public.plans set status = case
    when active_count >= max_participants then 'full'::public.plan_status
    when active_count >= min_participants then 'confirmed'::public.plan_status
    else 'open'::public.plan_status end
  where id = target_plan_id;

  insert into public.plan_messages (plan_id, sender_id, message_type, body)
  values (target_plan_id, caller_id, 'system', 'A participant left.');
  return membership;
end;
$$;

revoke all on function public.discover_nearby_plans(double precision, double precision, integer, timestamptz, timestamptz) from public, anon;
revoke all on function public.join_plan(uuid), public.leave_plan(uuid) from public, anon;
grant execute on function public.discover_nearby_plans(double precision, double precision, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.join_plan(uuid), public.leave_plan(uuid) to authenticated;
