create or replace function public.get_plan_detail(target_plan_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_plan public.plans%rowtype;
  target_venue public.venues%rowtype;
  member_payload jsonb;
  active_count integer;
  caller_membership public.plan_members%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  select * into target_plan from public.plans where id = target_plan_id;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if not (
    (target_plan.status in ('open', 'confirmed', 'full') and target_plan.starts_at between now() and now() + interval '6 hours')
    or target_plan.creator_id = caller_id
    or private.is_plan_member(target_plan_id, caller_id)
  ) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.plan_members pm
    where pm.plan_id = target_plan_id and pm.status = 'joined'
      and private.is_blocked_pair(caller_id, pm.user_id)
  ) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  select * into target_venue from public.venues where id = target_plan.venue_id;
  select * into caller_membership from public.plan_members
  where plan_id = target_plan_id and user_id = caller_id and status = 'joined';

  select count(*), coalesce(
    jsonb_agg(jsonb_build_object(
      'id', profile.id,
      'display_name', profile.display_name,
      'avatar_url', profile.avatar_url,
      'role', member.role
    ) order by member.joined_at),
    '[]'::jsonb
  ) into active_count, member_payload
  from public.plan_members member
  join public.profiles profile on profile.id = member.user_id
  where member.plan_id = target_plan_id and member.status = 'joined' and not profile.is_suspended;

  return jsonb_build_object(
    'id', target_plan.id,
    'creator_id', target_plan.creator_id,
    'title', target_plan.title,
    'note', target_plan.note,
    'activity_type', target_plan.activity_type,
    'starts_at', target_plan.starts_at,
    'expected_end_at', target_plan.expected_end_at,
    'status', target_plan.status,
    'min_participants', target_plan.min_participants,
    'max_participants', target_plan.max_participants,
    'joined_count', active_count,
    'seats_remaining', greatest(0, target_plan.max_participants - active_count),
    'is_joined', caller_membership.user_id is not null,
    'is_creator', target_plan.creator_id = caller_id,
    'venue', jsonb_build_object(
      'id', target_venue.id,
      'name', target_venue.name,
      'address', target_venue.address,
      'latitude', extensions.st_y(target_plan.location::extensions.geometry),
      'longitude', extensions.st_x(target_plan.location::extensions.geometry),
      'is_public_place', target_venue.is_public_place
    ),
    'members', member_payload
  );
end;
$$;

revoke all on function public.get_plan_detail(uuid) from public, anon;
grant execute on function public.get_plan_detail(uuid) to authenticated;
