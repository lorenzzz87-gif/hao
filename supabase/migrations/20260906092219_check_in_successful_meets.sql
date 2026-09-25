create type public.plan_check_in_status as (
  plan_id uuid,
  plan_status public.plan_status,
  self_checked_in boolean,
  checked_in_count bigint,
  successful_meet boolean,
  distance_m double precision
);

create or replace function private.refresh_plan_lifecycle(target_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_plan public.plans%rowtype;
  valid_check_ins integer;
begin
  select * into target_plan from public.plans where id = target_plan_id for update;
  if not found or target_plan.status = 'cancelled' then return; end if;

  if target_plan.status in ('open', 'confirmed', 'full') and now() >= target_plan.starts_at then
    update public.plans set status = 'started' where id = target_plan_id;
  end if;

  if now() >= coalesce(target_plan.expected_end_at, target_plan.starts_at + interval '2 hours')
     and target_plan.status not in ('completed', 'cancelled') then
    update public.plans set status = 'completed' where id = target_plan_id;
  end if;

  select count(*) into valid_check_ins
  from public.plan_members
  where plan_id = target_plan_id and checked_in_at is not null
    and checked_in_at between target_plan.starts_at - interval '30 minutes'
      and coalesce(target_plan.expected_end_at, target_plan.starts_at + interval '2 hours') + interval '30 minutes';

  if now() >= coalesce(target_plan.expected_end_at, target_plan.starts_at + interval '2 hours') and valid_check_ins >= 2 then
    insert into public.successful_meets (plan_id, checked_in_members)
    values (target_plan_id, valid_check_ins)
    on conflict (plan_id) do update set checked_in_members = greatest(public.successful_meets.checked_in_members, excluded.checked_in_members);
  end if;
end;
$$;

create or replace function public.get_plan_check_in_status(target_plan_id uuid)
returns public.plan_check_in_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result public.plan_check_in_status;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not private.is_plan_member(target_plan_id, caller_id) then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  perform private.refresh_plan_lifecycle(target_plan_id);

  select
    plan.id,
    plan.status,
    exists (select 1 from public.plan_members own where own.plan_id = plan.id and own.user_id = caller_id and own.checked_in_at is not null),
    (select count(*) from public.plan_members member where member.plan_id = plan.id and member.checked_in_at is not null),
    exists (select 1 from public.successful_meets meet where meet.plan_id = plan.id),
    null::double precision
  into result
  from public.plans plan where plan.id = target_plan_id;
  return result;
end;
$$;

create or replace function public.check_in(target_plan_id uuid, p_latitude double precision, p_longitude double precision)
returns public.plan_check_in_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_plan public.plans%rowtype;
  member public.plan_members%rowtype;
  check_in_distance double precision;
  result public.plan_check_in_status;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'invalid_coordinates' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then raise exception 'account_suspended' using errcode = '42501'; end if;

  select * into target_plan from public.plans where id = target_plan_id for update;
  if not found or target_plan.status = 'cancelled' then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  select * into member from public.plan_members where plan_id = target_plan_id and user_id = caller_id and status = 'joined' for update;
  if not found then raise exception 'membership_not_found' using errcode = 'P0002'; end if;

  if member.checked_in_at is null then
    if now() not between target_plan.starts_at - interval '30 minutes'
      and coalesce(target_plan.expected_end_at, target_plan.starts_at + interval '2 hours') + interval '30 minutes' then
      raise exception 'check_in_window_closed' using errcode = 'P0001';
    end if;
    check_in_distance := extensions.st_distance(
      target_plan.location,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
    );
    if check_in_distance > 300 then raise exception 'too_far_from_meeting_place' using errcode = 'P0001'; end if;
    update public.plan_members set checked_in_at = now() where plan_id = target_plan_id and user_id = caller_id;
  end if;

  perform private.refresh_plan_lifecycle(target_plan_id);
  select
    target_plan_id,
    (select status from public.plans where id = target_plan_id),
    true,
    (select count(*) from public.plan_members current_member where current_member.plan_id = target_plan_id and current_member.checked_in_at is not null),
    exists (select 1 from public.successful_meets meet where meet.plan_id = target_plan_id),
    check_in_distance
  into result;
  return result;
end;
$$;

create or replace function public.get_my_meet_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'successful_meets', count(distinct meet.plan_id),
    'plans_checked_in', count(distinct member.plan_id) filter (where member.checked_in_at is not null)
  )
  from public.plan_members member
  left join public.successful_meets meet on meet.plan_id = member.plan_id
  where auth.uid() is not null and member.user_id = auth.uid();
$$;

revoke all on function private.refresh_plan_lifecycle(uuid) from public, anon, authenticated;
revoke all on function public.get_plan_check_in_status(uuid) from public, anon;
revoke all on function public.check_in(uuid, double precision, double precision) from public, anon;
revoke all on function public.get_my_meet_stats() from public, anon;
grant execute on function public.get_plan_check_in_status(uuid) to authenticated;
grant execute on function public.check_in(uuid, double precision, double precision) to authenticated;
grant execute on function public.get_my_meet_stats() to authenticated;
