create or replace function public.create_plan(
  p_activity_type text,
  p_starts_at timestamptz,
  p_venue_name text,
  p_venue_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_max_participants integer,
  p_note text default null,
  p_title text default null
)
returns public.plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_venue_id uuid;
  new_plan public.plans%rowtype;
  clean_note text := nullif(btrim(p_note), '');
  clean_title text := nullif(btrim(p_title), '');
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = caller_id and onboarding_completed and not is_suspended
  ) then
    raise exception 'profile_not_eligible' using errcode = '42501';
  end if;
  if not exists (select 1 from public.interests where slug = p_activity_type) then
    raise exception 'invalid_activity_type' using errcode = '22023';
  end if;
  if p_starts_at < now() + interval '10 minutes' or p_starts_at > now() + interval '6 hours' then
    raise exception 'start_time_must_be_within_10_minutes_and_6_hours' using errcode = '22023';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'invalid_coordinates' using errcode = '22023';
  end if;
  if nullif(btrim(p_venue_name), '') is null or char_length(btrim(p_venue_name)) > 120 then
    raise exception 'invalid_venue_name' using errcode = '22023';
  end if;
  if p_venue_address is not null and char_length(p_venue_address) > 240 then
    raise exception 'venue_address_too_long' using errcode = '22023';
  end if;
  if p_max_participants not between 2 and 12 then
    raise exception 'max_participants_must_be_2_to_12' using errcode = '22023';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  if clean_title is not null and char_length(clean_title) > 120 then
    raise exception 'title_too_long' using errcode = '22023';
  end if;

  insert into public.venues (name, address, location, source, is_public_place)
  values (
    btrim(p_venue_name), nullif(btrim(p_venue_address), ''),
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    'user', true
  ) returning id into new_venue_id;

  insert into public.plans (
    creator_id, activity_type, title, note, venue_id, location, starts_at,
    expected_end_at, min_participants, max_participants, confirmation_deadline, status, source
  ) values (
    caller_id,
    p_activity_type,
    coalesce(clean_title, initcap(replace(p_activity_type, '_', ' ')) || ' nearby'),
    clean_note,
    new_venue_id,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_starts_at,
    p_starts_at + interval '90 minutes',
    2,
    p_max_participants,
    greatest(now() + interval '5 minutes', p_starts_at - interval '30 minutes'),
    'open',
    'user'
  ) returning * into new_plan;

  insert into public.plan_interests (plan_id, interest_id)
  select new_plan.id, id from public.interests where slug = p_activity_type;

  insert into public.plan_members (plan_id, user_id, role, status)
  values (new_plan.id, caller_id, 'creator', 'joined');

  return new_plan;
end;
$$;

revoke all on function public.create_plan(text, timestamptz, text, text, double precision, double precision, integer, text, text) from public, anon;
grant execute on function public.create_plan(text, timestamptz, text, text, double precision, double precision, integer, text, text) to authenticated;
