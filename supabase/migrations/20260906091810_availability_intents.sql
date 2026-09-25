create type public.intent_match_summary as (
  compatible_people bigint,
  shared_interest text
);

create or replace function public.create_availability_intent(
  p_expires_at timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_max_distance_m integer,
  p_interest_slugs text[]
)
returns public.availability_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_interest_count integer;
  new_intent public.availability_intents%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = caller_id and onboarding_completed and not is_suspended) then
    raise exception 'profile_not_eligible' using errcode = '42501';
  end if;
  if p_expires_at < now() + interval '30 minutes' or p_expires_at > now() + interval '12 hours' then
    raise exception 'invalid_availability_window' using errcode = '22023';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'invalid_coordinates' using errcode = '22023'; end if;
  if p_max_distance_m not between 500 and 10000 then raise exception 'invalid_distance' using errcode = '22023'; end if;

  select count(distinct interest.slug) into clean_interest_count
  from public.interests interest where interest.slug = any(coalesce(p_interest_slugs, array[]::text[]));
  if clean_interest_count = 0 or clean_interest_count > 8 or clean_interest_count <> cardinality(array(select distinct unnest(coalesce(p_interest_slugs, array[]::text[])))) then
    raise exception 'invalid_interests' using errcode = '22023';
  end if;

  update public.availability_intents set status = 'cancelled'
  where user_id = caller_id and status = 'active';

  insert into public.availability_intents (user_id, starts_at, expires_at, location, max_distance_m, status)
  values (
    caller_id, now(), p_expires_at,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_max_distance_m, 'active'
  ) returning * into new_intent;

  insert into public.intent_interests (intent_id, interest_id)
  select new_intent.id, interest.id from public.interests interest where interest.slug = any(p_interest_slugs);
  return new_intent;
end;
$$;

create or replace function public.recommend_plans_for_intent(target_intent_id uuid)
returns setof public.nearby_plan
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_intent public.availability_intents%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into target_intent from public.availability_intents
  where id = target_intent_id and user_id = caller_id and status = 'active' and expires_at > now();
  if not found then raise exception 'intent_not_found' using errcode = 'P0002'; end if;

  return query
  with intent_categories as (
    select interest.slug from public.intent_interests selected
    join public.interests interest on interest.id = selected.interest_id
    where selected.intent_id = target_intent_id
  ), candidates as (
    select
      plan.id, plan.title, plan.activity_type, plan.starts_at, plan.venue_id,
      extensions.st_y(plan.location::extensions.geometry) as latitude,
      extensions.st_x(plan.location::extensions.geometry) as longitude,
      extensions.st_distance(plan.location, target_intent.location) as distance_m,
      count(member.user_id) filter (where member.status = 'joined') as joined_count,
      plan.max_participants, plan.status,
      case when plan.activity_type in (select slug from intent_categories) or exists (select 1 from intent_categories where slug = 'anything') then 1.0 else 0.0 end as interest_score
    from public.plans plan
    left join public.plan_members member on member.plan_id = plan.id
    where plan.status in ('open', 'confirmed')
      and plan.starts_at between now() and least(target_intent.expires_at, now() + interval '6 hours')
      and extensions.st_dwithin(plan.location, target_intent.location, target_intent.max_distance_m)
      and not exists (
        select 1 from public.plan_members blocked_member
        where blocked_member.plan_id = plan.id and blocked_member.status = 'joined'
          and private.is_blocked_pair(caller_id, blocked_member.user_id)
      )
    group by plan.id
  )
  select
    candidate.id, candidate.title, candidate.activity_type, candidate.starts_at, candidate.venue_id,
    candidate.latitude, candidate.longitude, candidate.distance_m, candidate.joined_count,
    candidate.max_participants, candidate.status,
    greatest(0, 1 - extract(epoch from (candidate.starts_at - now())) / greatest(1, extract(epoch from (least(target_intent.expires_at, now() + interval '6 hours') - now())))) * 0.45
      + greatest(0, 1 - candidate.distance_m / target_intent.max_distance_m) * 0.35
      + candidate.interest_score * 0.20 as score
  from candidates candidate
  order by score desc, starts_at asc;
end;
$$;

create or replace function public.find_compatible_intents(target_intent_id uuid)
returns public.intent_match_summary
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_intent public.availability_intents%rowtype;
  result public.intent_match_summary;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into target_intent from public.availability_intents
  where id = target_intent_id and user_id = caller_id and status = 'active' and expires_at > now();
  if not found then raise exception 'intent_not_found' using errcode = 'P0002'; end if;

  select count(distinct candidate.user_id), min(shared.slug)
  into result.compatible_people, result.shared_interest
  from public.availability_intents candidate
  join public.intent_interests candidate_interest on candidate_interest.intent_id = candidate.id
  join public.interests shared on shared.id = candidate_interest.interest_id
  where candidate.id <> target_intent.id and candidate.user_id <> caller_id
    and candidate.status = 'active' and candidate.expires_at > now()
    and least(candidate.expires_at, target_intent.expires_at) >= greatest(candidate.starts_at, target_intent.starts_at) + interval '45 minutes'
    and extensions.st_dwithin(candidate.location, target_intent.location, least(2000, target_intent.max_distance_m, candidate.max_distance_m))
    and not private.is_blocked_pair(caller_id, candidate.user_id)
    and (
      shared.slug = 'anything'
      or exists (select 1 from public.intent_interests own_interest where own_interest.intent_id = target_intent.id and own_interest.interest_id = candidate_interest.interest_id)
      or exists (select 1 from public.intent_interests own_any join public.interests own_label on own_label.id = own_any.interest_id where own_any.intent_id = target_intent.id and own_label.slug = 'anything')
    );
  return result;
end;
$$;

revoke all on function public.create_availability_intent(timestamptz, double precision, double precision, integer, text[]) from public, anon;
revoke all on function public.recommend_plans_for_intent(uuid), public.find_compatible_intents(uuid) from public, anon;
grant execute on function public.create_availability_intent(timestamptz, double precision, double precision, integer, text[]) to authenticated;
grant execute on function public.recommend_plans_for_intent(uuid), public.find_compatible_intents(uuid) to authenticated;

revoke insert, update on public.availability_intents from authenticated;
revoke insert, delete on public.intent_interests from authenticated;
