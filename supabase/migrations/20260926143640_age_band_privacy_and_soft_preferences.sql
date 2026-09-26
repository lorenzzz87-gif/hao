-- Age bands are a privacy-preserving compatibility cue, never a discovery filter.
-- Exact birth dates remain server-only and summaries are suppressed below three members.

revoke update (birth_date) on public.profiles from authenticated;

create or replace function private.lock_birth_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
    raise exception 'birth_date_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.lock_birth_date() from public, anon, authenticated;

drop trigger if exists profiles_lock_birth_date on public.profiles;
create trigger profiles_lock_birth_date
before update of birth_date on public.profiles
for each row execute function private.lock_birth_date();

create or replace function private.age_band(value date)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when value is null then null
    when extract(year from age(current_date, value)) < 18 then null
    when extract(year from age(current_date, value)) < 20 then '18_19'
    when extract(year from age(current_date, value)) < 30 then '20s'
    when extract(year from age(current_date, value)) < 40 then '30s'
    when extract(year from age(current_date, value)) < 50 then '40s'
    when extract(year from age(current_date, value)) < 60 then '50s'
    else '60_plus'
  end;
$$;
revoke all on function private.age_band(date) from public, anon, authenticated;

revoke all on function public.complete_onboarding(text, date, text, text[]) from public, anon, authenticated;
drop function public.complete_onboarding(text, date, text, text[]);
create function public.complete_onboarding(
  display_name text,
  birth_date date,
  primary_language text,
  interest_slugs text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  selected_count integer;
  updated_profile public.profiles%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if nullif(btrim(display_name), '') is null or char_length(btrim(display_name)) > 60 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  if birth_date is null or birth_date > current_date or birth_date < date '1900-01-01' then
    raise exception 'invalid_birth_date' using errcode = 'P0001';
  end if;
  if age(current_date, birth_date) < interval '18 years' then
    raise exception 'underage' using errcode = 'P0001';
  end if;
  if primary_language not in ('en', 'it', 'zh') then
    raise exception 'unsupported_language' using errcode = '22023';
  end if;

  select count(distinct interest.slug) into selected_count
  from public.interests interest where interest.slug = any(interest_slugs);
  if selected_count < 3 or selected_count > 5 or selected_count <> cardinality(interest_slugs) then
    raise exception 'select_3_to_5_valid_interests' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = btrim(complete_onboarding.display_name),
      birth_date = complete_onboarding.birth_date,
      primary_language = complete_onboarding.primary_language,
      onboarding_completed = true
  where id = caller_id and not is_suspended
  returning * into updated_profile;
  if not found then raise exception 'profile_unavailable' using errcode = '42501'; end if;

  delete from public.profile_languages where profile_id = caller_id;
  insert into public.profile_languages (profile_id, language_code)
  values (caller_id, complete_onboarding.primary_language);
  delete from public.profile_interests where profile_id = caller_id;
  insert into public.profile_interests (profile_id, interest_id)
  select caller_id, interest.id from public.interests interest where interest.slug = any(interest_slugs);
  return jsonb_build_object(
    'id', updated_profile.id,
    'display_name', updated_profile.display_name,
    'primary_language', updated_profile.primary_language,
    'onboarding_completed', updated_profile.onboarding_completed,
    'age_band', private.age_band(updated_profile.birth_date)
  );
end;
$$;
revoke all on function public.complete_onboarding(text, date, text, text[]) from public, anon;
grant execute on function public.complete_onboarding(text, date, text, text[]) to authenticated;

create or replace function public.get_my_age_band()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select private.age_band(profile.birth_date) into result
  from public.profiles profile where profile.id = caller_id and not profile.is_suspended;
  if not found then raise exception 'profile_unavailable' using errcode = 'P0002'; end if;
  return result;
end;
$$;
revoke all on function public.get_my_age_band() from public, anon;
grant execute on function public.get_my_age_band() to authenticated;

alter table public.plans
add column if not exists preferred_age text not null default 'any';
alter table public.plans drop constraint if exists plans_preferred_age_check;
alter table public.plans add constraint plans_preferred_age_check
check (preferred_age in ('any', '18_24', '25_34', '35_44', '45_plus'));

create or replace function private.is_within_preferred_age(target_plan_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case plan.preferred_age
      when 'any' then true
      when '18_24' then user_age between 18 and 24
      when '25_34' then user_age between 25 and 34
      when '35_44' then user_age between 35 and 44
      when '45_plus' then user_age >= 45
      else false
    end
    from public.plans plan
    cross join lateral (
      select extract(year from age(current_date, profile.birth_date))::integer as user_age
      from public.profiles profile where profile.id = target_user_id
    ) viewer
    where plan.id = target_plan_id
  ), false);
$$;
revoke all on function private.is_within_preferred_age(uuid, uuid) from public, anon, authenticated;

create or replace function private.plan_age_summary(target_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bands as (
    select private.age_band(profile.birth_date) as band,
      case private.age_band(profile.birth_date)
        when '18_19' then 1 when '20s' then 2 when '30s' then 3
        when '40s' then 4 when '50s' then 5 when '60_plus' then 6
      end as band_order
    from public.plan_members member
    join public.profiles profile on profile.id = member.user_id
    where member.plan_id = target_plan_id and member.status = 'joined'
      and not profile.is_suspended and profile.birth_date is not null
  ), counts as (
    select band, band_order, count(*)::integer as member_count from bands group by band, band_order
  ), totals as (
    select count(*)::integer as total from bands
  ), dominant as (
    select band, member_count from counts order by member_count desc, band_order asc limit 1
  )
  select case
    when totals.total < 3 then null
    when dominant.member_count::numeric / totals.total >= 0.6
      then jsonb_build_object('type', 'mostly', 'band', dominant.band)
    else jsonb_build_object(
      'type', 'range',
      'from', (select band from counts order by band_order asc limit 1),
      'to', (select band from counts order by band_order desc limit 1)
    )
  end
  from totals left join dominant on true;
$$;
revoke all on function private.plan_age_summary(uuid) from public, anon, authenticated;

create table if not exists public.age_prompt_events (
  id bigint generated by default as identity primary key,
  interaction_id uuid not null,
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('shown', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (interaction_id, action)
);
create index if not exists age_prompt_events_plan_created_idx on public.age_prompt_events(plan_id, created_at);
alter table public.age_prompt_events enable row level security;
revoke all on table public.age_prompt_events from anon, authenticated;

create or replace function public.record_age_prompt_event(
  p_plan_id uuid,
  p_interaction_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('shown', 'cancelled') then raise exception 'invalid_age_prompt_action' using errcode = '22023'; end if;
  if not exists (select 1 from public.plans where id = p_plan_id) then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  insert into public.age_prompt_events (interaction_id, plan_id, user_id, action)
  values (p_interaction_id, p_plan_id, caller_id, p_action)
  on conflict (interaction_id, action) do nothing;
end;
$$;
revoke all on function public.record_age_prompt_event(uuid, uuid, text) from public, anon;
grant execute on function public.record_age_prompt_event(uuid, uuid, text) to authenticated;

alter type public.nearby_plan add attribute preferred_age text;
alter type public.nearby_plan add attribute age_summary jsonb;
alter type public.nearby_plan add attribute viewer_outside_preferred_age boolean;

create or replace function public.discover_nearby_plans(
  lat double precision,
  lng double precision,
  radius_m integer default 5000,
  from_ts timestamptz default now(),
  to_ts timestamptz default now() + interval '6 hours'
)
returns setof public.nearby_plan
language sql stable security definer set search_path = ''
as $$
  with candidates as (
    select plan.id, plan.title, plan.activity_type, plan.starts_at, plan.venue_id,
      extensions.st_y(plan.location::extensions.geometry) as latitude,
      extensions.st_x(plan.location::extensions.geometry) as longitude,
      extensions.st_distance(plan.location, extensions.st_point(lng, lat)::extensions.geography) as distance_m,
      count(member.user_id) filter (where member.status = 'joined') as joined_count,
      plan.max_participants, plan.status, plan.preferred_age
    from public.plans plan left join public.plan_members member on member.plan_id = plan.id
    where plan.status in ('open', 'confirmed', 'full') and auth.uid() is not null
      and lat between -90 and 90 and lng between -180 and 180 and radius_m between 100 and 50000
      and from_ts >= now() - interval '5 minutes' and to_ts > from_ts and to_ts <= from_ts + interval '6 hours'
      and plan.starts_at between from_ts and to_ts
      and extensions.st_dwithin(plan.location, extensions.st_point(lng, lat)::extensions.geography, radius_m)
      and not exists (select 1 from public.plan_members blocked where blocked.plan_id = plan.id and blocked.status = 'joined' and private.is_blocked_pair(auth.uid(), blocked.user_id))
      and not exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.is_suspended)
    group by plan.id
  )
  select candidate.id, candidate.title, candidate.activity_type, candidate.starts_at, candidate.venue_id,
    candidate.latitude, candidate.longitude, candidate.distance_m, candidate.joined_count,
    candidate.max_participants, candidate.status,
    greatest(0, 1 - extract(epoch from (candidate.starts_at - from_ts)) / greatest(1, extract(epoch from (to_ts - from_ts)))) * 0.55
      + greatest(0, 1 - candidate.distance_m / radius_m) * 0.45 as score,
    candidate.preferred_age, private.plan_age_summary(candidate.id),
    candidate.preferred_age <> 'any' and not private.is_within_preferred_age(candidate.id, auth.uid())
  from candidates candidate order by score desc, starts_at asc;
$$;

create or replace function public.recommend_plans_for_intent(target_intent_id uuid)
returns setof public.nearby_plan
language plpgsql stable security definer set search_path = ''
as $$
declare caller_id uuid := auth.uid(); target_intent public.availability_intents%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into target_intent from public.availability_intents
  where id = target_intent_id and user_id = caller_id and status = 'active' and expires_at > now();
  if not found then raise exception 'intent_not_found' using errcode = 'P0002'; end if;
  return query
  with intent_categories as (
    select interest.slug from public.intent_interests selected join public.interests interest on interest.id = selected.interest_id where selected.intent_id = target_intent_id
  ), candidates as (
    select plan.id, plan.title, plan.activity_type, plan.starts_at, plan.venue_id,
      extensions.st_y(plan.location::extensions.geometry) as latitude,
      extensions.st_x(plan.location::extensions.geometry) as longitude,
      extensions.st_distance(plan.location, target_intent.location) as distance_m,
      count(member.user_id) filter (where member.status = 'joined') as joined_count,
      plan.max_participants, plan.status, plan.preferred_age,
      case when plan.activity_type in (select slug from intent_categories) or exists (select 1 from intent_categories where slug = 'anything') then 1.0 else 0.0 end as interest_score
    from public.plans plan left join public.plan_members member on member.plan_id = plan.id
    where plan.status in ('open', 'confirmed')
      and plan.starts_at between now() and least(target_intent.expires_at, now() + interval '6 hours')
      and extensions.st_dwithin(plan.location, target_intent.location, target_intent.max_distance_m)
      and not exists (select 1 from public.plan_members blocked where blocked.plan_id = plan.id and blocked.status = 'joined' and private.is_blocked_pair(caller_id, blocked.user_id))
    group by plan.id
  )
  select candidate.id, candidate.title, candidate.activity_type, candidate.starts_at, candidate.venue_id,
    candidate.latitude, candidate.longitude, candidate.distance_m, candidate.joined_count,
    candidate.max_participants, candidate.status,
    greatest(0, 1 - extract(epoch from (candidate.starts_at - now())) / greatest(1, extract(epoch from (least(target_intent.expires_at, now() + interval '6 hours') - now())))) * 0.45
      + greatest(0, 1 - candidate.distance_m / target_intent.max_distance_m) * 0.35 + candidate.interest_score * 0.20 as score,
    candidate.preferred_age, private.plan_age_summary(candidate.id),
    candidate.preferred_age <> 'any' and not private.is_within_preferred_age(candidate.id, caller_id)
  from candidates candidate order by score desc, starts_at asc;
end;
$$;

revoke all on function public.join_plan(uuid) from public, anon, authenticated;
drop function public.join_plan(uuid);
create function public.join_plan(
  target_plan_id uuid,
  p_acknowledged_age_preference boolean,
  p_age_prompt_interaction_id uuid
)
returns public.plan_members
language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid(); target_plan public.plans%rowtype;
  active_count integer; membership public.plan_members%rowtype; outside_preference boolean;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into target_plan from public.plans where id = target_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.plan_members member where member.plan_id = target_plan_id and member.status = 'joined' and private.is_blocked_pair(caller_id, member.user_id)) then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then raise exception 'account_suspended' using errcode = '42501'; end if;
  select * into membership from public.plan_members where plan_id = target_plan_id and user_id = caller_id and status = 'joined';
  if found then return membership; end if;
  if target_plan.status not in ('open', 'confirmed') or target_plan.starts_at <= now() then raise exception 'plan_not_joinable' using errcode = 'P0001'; end if;
  select count(*) into active_count from public.plan_members where plan_id = target_plan_id and status = 'joined';
  if active_count >= target_plan.max_participants then raise exception 'plan_full' using errcode = 'P0001'; end if;

  outside_preference := target_plan.preferred_age <> 'any' and not private.is_within_preferred_age(target_plan_id, caller_id);
  if outside_preference and not coalesce(p_acknowledged_age_preference, false) then
    raise exception 'age_preference_ack_required' using errcode = 'P0001';
  end if;
  if outside_preference and p_acknowledged_age_preference then
    if p_age_prompt_interaction_id is null then raise exception 'age_prompt_interaction_required' using errcode = '22023'; end if;
    insert into public.age_prompt_events (interaction_id, plan_id, user_id, action)
    values (p_age_prompt_interaction_id, target_plan_id, caller_id, 'confirmed')
    on conflict (interaction_id, action) do nothing;
  end if;

  insert into public.plan_members (plan_id, user_id, role, status, joined_at, left_at)
  values (target_plan_id, caller_id, 'member', 'joined', now(), null)
  on conflict (plan_id, user_id) do update set status = 'joined', joined_at = now(), left_at = null
  returning * into membership;
  active_count := active_count + 1;
  update public.plans set status = case when active_count >= max_participants then 'full'::public.plan_status when active_count >= min_participants then 'confirmed'::public.plan_status else 'open'::public.plan_status end where id = target_plan_id;
  insert into public.plan_messages (plan_id, sender_id, message_type, body) values (target_plan_id, caller_id, 'system', 'A participant joined.');
  if active_count = target_plan.min_participants then insert into public.plan_messages (plan_id, sender_id, message_type, body) values (target_plan_id, null, 'system', 'Plan confirmed.'); end if;
  return membership;
end;
$$;
revoke all on function public.join_plan(uuid, boolean, uuid) from public, anon;
grant execute on function public.join_plan(uuid, boolean, uuid) to authenticated;

revoke all on function public.create_plan(text, timestamptz, text, text, double precision, double precision, integer, text, text) from public, anon, authenticated;
drop function public.create_plan(text, timestamptz, text, text, double precision, double precision, integer, text, text);
create function public.create_plan(
  p_activity_type text, p_starts_at timestamptz, p_venue_name text, p_venue_address text,
  p_latitude double precision, p_longitude double precision, p_max_participants integer,
  p_note text, p_title text, p_preferred_age text
)
returns public.plans
language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid(); new_venue_id uuid; new_plan public.plans%rowtype;
  clean_note text := nullif(btrim(p_note), ''); clean_title text := nullif(btrim(p_title), '');
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = caller_id and onboarding_completed and not is_suspended) then raise exception 'profile_not_eligible' using errcode = '42501'; end if;
  if not exists (select 1 from public.interests where slug = p_activity_type) then raise exception 'invalid_activity_type' using errcode = '22023'; end if;
  if p_starts_at < now() + interval '10 minutes' or p_starts_at > now() + interval '6 hours' then raise exception 'start_time_must_be_within_10_minutes_and_6_hours' using errcode = '22023'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'invalid_coordinates' using errcode = '22023'; end if;
  if nullif(btrim(p_venue_name), '') is null or char_length(btrim(p_venue_name)) > 120 then raise exception 'invalid_venue_name' using errcode = '22023'; end if;
  if p_venue_address is not null and char_length(p_venue_address) > 240 then raise exception 'venue_address_too_long' using errcode = '22023'; end if;
  if p_max_participants not between 2 and 12 then raise exception 'max_participants_must_be_2_to_12' using errcode = '22023'; end if;
  if clean_note is not null and char_length(clean_note) > 1000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  if clean_title is not null and char_length(clean_title) > 120 then raise exception 'title_too_long' using errcode = '22023'; end if;
  if p_preferred_age is null or p_preferred_age not in ('any', '18_24', '25_34', '35_44', '45_plus') then raise exception 'invalid_preferred_age' using errcode = '22023'; end if;
  insert into public.venues (name, address, location, source, is_public_place)
  values (btrim(p_venue_name), nullif(btrim(p_venue_address), ''), extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography, 'user', true)
  returning id into new_venue_id;
  insert into public.plans (creator_id, activity_type, title, note, venue_id, location, starts_at, expected_end_at, min_participants, max_participants, confirmation_deadline, status, source, preferred_age)
  values (caller_id, p_activity_type, coalesce(clean_title, initcap(replace(p_activity_type, '_', ' ')) || ' nearby'), clean_note, new_venue_id,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_starts_at, p_starts_at + interval '90 minutes', 2, p_max_participants,
    greatest(now() + interval '5 minutes', p_starts_at - interval '30 minutes'), 'open', 'user', p_preferred_age)
  returning * into new_plan;
  insert into public.plan_interests (plan_id, interest_id) select new_plan.id, id from public.interests where slug = p_activity_type;
  insert into public.plan_members (plan_id, user_id, role, status) values (new_plan.id, caller_id, 'creator', 'joined');
  return new_plan;
end;
$$;
revoke all on function public.create_plan(text, timestamptz, text, text, double precision, double precision, integer, text, text, text) from public, anon;
grant execute on function public.create_plan(text, timestamptz, text, text, double precision, double precision, integer, text, text, text) to authenticated;

create or replace function public.get_plan_detail(target_plan_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid(); target_plan public.plans%rowtype; target_venue public.venues%rowtype;
  member_payload jsonb; active_count integer; caller_membership public.plan_members%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then raise exception 'account_suspended' using errcode = '42501'; end if;
  select * into target_plan from public.plans where id = target_plan_id;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if not ((target_plan.status in ('open', 'confirmed', 'full') and target_plan.starts_at between now() and now() + interval '6 hours') or target_plan.creator_id = caller_id or private.is_plan_member(target_plan_id, caller_id)) then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.plan_members member where member.plan_id = target_plan_id and member.status = 'joined' and private.is_blocked_pair(caller_id, member.user_id)) then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  select * into target_venue from public.venues where id = target_plan.venue_id;
  select * into caller_membership from public.plan_members where plan_id = target_plan_id and user_id = caller_id and status = 'joined';
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id', profile.id, 'display_name', profile.display_name, 'avatar_url', profile.avatar_url, 'role', member.role,
    'phone_verified', exists (select 1 from auth.users account where account.id = profile.id and account.phone_confirmed_at is not null),
    'identity_verified', profile.identity_verification_status = 'verified',
    'common_interests', (select count(*) from public.profile_interests theirs join public.profile_interests mine on mine.interest_id = theirs.interest_id and mine.profile_id = caller_id where theirs.profile_id = profile.id),
    'successful_meets', (select count(*) from public.plan_members history join public.successful_meets meet on meet.plan_id = history.plan_id where history.user_id = profile.id and history.checked_in_at is not null)
  ) order by member.joined_at), '[]'::jsonb)
  into active_count, member_payload from public.plan_members member join public.profiles profile on profile.id = member.user_id
  where member.plan_id = target_plan_id and member.status = 'joined' and not profile.is_suspended;
  return jsonb_build_object(
    'id', target_plan.id, 'creator_id', target_plan.creator_id, 'title', target_plan.title, 'note', target_plan.note,
    'activity_type', target_plan.activity_type, 'starts_at', target_plan.starts_at, 'expected_end_at', target_plan.expected_end_at,
    'status', target_plan.status, 'min_participants', target_plan.min_participants, 'max_participants', target_plan.max_participants,
    'joined_count', active_count, 'seats_remaining', greatest(0, target_plan.max_participants - active_count),
    'is_joined', caller_membership.user_id is not null, 'is_creator', target_plan.creator_id = caller_id,
    'preferred_age', target_plan.preferred_age, 'age_summary', private.plan_age_summary(target_plan_id),
    'viewer_outside_preferred_age', target_plan.preferred_age <> 'any' and not private.is_within_preferred_age(target_plan_id, caller_id),
    'venue', jsonb_build_object('id', target_venue.id, 'name', target_venue.name, 'address', target_venue.address,
      'latitude', extensions.st_y(target_plan.location::extensions.geometry), 'longitude', extensions.st_x(target_plan.location::extensions.geometry),
      'is_public_place', target_venue.is_public_place, 'is_approximate', target_venue.external_place_id is null),
    'members', member_payload
  );
end;
$$;
revoke all on function public.get_plan_detail(uuid) from public, anon;
grant execute on function public.get_plan_detail(uuid) to authenticated;
