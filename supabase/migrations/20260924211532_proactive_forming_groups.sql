create table public.forming_groups (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null references public.interests(slug),
  location extensions.geography(point, 4326) not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'forming' check (status in ('forming', 'plan_created', 'expired', 'cancelled')),
  plan_id uuid references public.plans(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index forming_groups_active_idx on public.forming_groups(status, expires_at);
create index forming_groups_location_gix on public.forming_groups using gist(location);

create table public.forming_group_members (
  group_id uuid not null references public.forming_groups(id) on delete cascade,
  intent_id uuid not null unique references public.availability_intents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null default 'invited' check (response in ('invited', 'accepted', 'declined')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index forming_group_members_user_idx on public.forming_group_members(user_id, response);

alter table public.forming_groups enable row level security;
alter table public.forming_group_members enable row level security;

revoke all on public.forming_groups, public.forming_group_members from anon, authenticated;

create type public.forming_group_summary as (
  id uuid,
  activity_type text,
  member_count bigint,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  plan_id uuid,
  response text
);

create or replace function public.get_my_forming_group()
returns public.forming_group_summary
language sql
stable
security definer
set search_path = ''
as $$
  select row(
    group_row.id,
    group_row.activity_type,
    (select count(*) from public.forming_group_members count_member where count_member.group_id = group_row.id),
    group_row.starts_at,
    group_row.expires_at,
    group_row.status,
    group_row.plan_id,
    member.response
  )::public.forming_group_summary
  from public.forming_group_members member
  join public.forming_groups group_row on group_row.id = member.group_id
  where member.user_id = auth.uid()
    and member.response <> 'declined'
    and group_row.status in ('forming', 'plan_created')
    and group_row.expires_at > now()
  order by group_row.created_at desc
  limit 1
$$;

create or replace function public.create_forming_group(target_intent_id uuid)
returns public.forming_group_summary
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_intent public.availability_intents%rowtype;
  chosen_activity text;
  new_group public.forming_groups%rowtype;
  candidate_count integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select * into target_intent
  from public.availability_intents
  where id = target_intent_id and user_id = caller_id and status = 'active' and expires_at > now();
  if not found then raise exception 'intent_not_found' using errcode = 'P0002'; end if;

  select group_row.* into new_group
  from public.forming_group_members member
  join public.forming_groups group_row on group_row.id = member.group_id
  where member.intent_id = target_intent_id
    and group_row.status in ('forming', 'plan_created')
    and group_row.expires_at > now()
  limit 1;
  if found then return public.get_my_forming_group(); end if;

  select interest.slug into chosen_activity
  from public.intent_interests selected
  join public.interests interest on interest.id = selected.interest_id
  where selected.intent_id = target_intent_id and interest.slug <> 'anything'
  order by interest.slug
  limit 1;
  if chosen_activity is null then chosen_activity := 'coffee'; end if;

  perform pg_advisory_xact_lock(hashtextextended(chosen_activity || ':' || round(extensions.st_y(target_intent.location::extensions.geometry)::numeric, 2)::text || ':' || round(extensions.st_x(target_intent.location::extensions.geometry)::numeric, 2)::text, 0));

  create temporary table if not exists forming_candidates_tmp (
    intent_id uuid primary key,
    user_id uuid not null,
    location extensions.geography(point, 4326) not null
  ) on commit drop;
  truncate forming_candidates_tmp;

  insert into forming_candidates_tmp (intent_id, user_id, location)
  select candidate.id, candidate.user_id, candidate.location
  from public.availability_intents candidate
  where candidate.status = 'active'
    and candidate.expires_at > now()
    and least(candidate.expires_at, target_intent.expires_at) >= greatest(candidate.starts_at, target_intent.starts_at) + interval '45 minutes'
    and extensions.st_dwithin(candidate.location, target_intent.location, least(2000, target_intent.max_distance_m, candidate.max_distance_m))
    and not private.is_blocked_pair(caller_id, candidate.user_id)
    and not exists (
      select 1 from public.forming_group_members existing_member
      join public.forming_groups existing_group on existing_group.id = existing_member.group_id
      where existing_member.intent_id = candidate.id
        and existing_group.status in ('forming', 'plan_created')
        and existing_group.expires_at > now()
    )
    and (
      candidate.id = target_intent_id
      or exists (
        select 1 from public.intent_interests candidate_interest
        join public.interests candidate_label on candidate_label.id = candidate_interest.interest_id
        where candidate_interest.intent_id = candidate.id
          and candidate_label.slug in (chosen_activity, 'anything')
      )
    )
  order by extensions.st_distance(candidate.location, target_intent.location), candidate.created_at
  limit 6;

  select count(*) into candidate_count from forming_candidates_tmp;
  if candidate_count < 3 then return null; end if;

  insert into public.forming_groups (
    activity_type, location, starts_at, expires_at, status, created_by
  )
  select
    chosen_activity,
    extensions.st_centroid(extensions.st_collect(candidate.location::extensions.geometry))::extensions.geography,
    now() + interval '30 minutes',
    least(target_intent.expires_at, now() + interval '10 minutes'),
    'forming',
    caller_id
  from forming_candidates_tmp candidate
  returning * into new_group;

  insert into public.forming_group_members (group_id, intent_id, user_id)
  select new_group.id, candidate.intent_id, candidate.user_id from forming_candidates_tmp candidate;

  return public.get_my_forming_group();
end;
$$;

create or replace function public.respond_to_forming_group(p_group_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  group_row public.forming_groups%rowtype;
  member_intent_id uuid;
  new_venue_id uuid;
  new_plan_id uuid;
  activity_label text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select * into group_row from public.forming_groups
  where id = p_group_id and expires_at > now()
  for update;
  if not found then raise exception 'forming_group_not_found' using errcode = 'P0002'; end if;

  select intent_id into member_intent_id
  from public.forming_group_members
  where group_id = p_group_id and user_id = caller_id
  for update;
  if not found then raise exception 'not_invited' using errcode = '42501'; end if;

  update public.forming_group_members
  set response = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where group_id = p_group_id and user_id = caller_id;

  if not p_accept then return null; end if;

  new_plan_id := group_row.plan_id;
  if new_plan_id is null then
    select label into activity_label from public.interests where slug = group_row.activity_type;

    insert into public.venues (name, address, location, source, is_public_place)
    values ('Public meetup area', 'Choose a public venue together in Orbit', group_row.location, 'system', true)
    returning id into new_venue_id;

    insert into public.plans (
      creator_id, activity_type, title, note, venue_id, location, starts_at,
      expected_end_at, min_participants, max_participants, confirmation_deadline, status, source
    ) values (
      caller_id,
      group_row.activity_type,
      coalesce(activity_label, initcap(group_row.activity_type)) || ' nearby',
      'HAO brought together people who are free for the same thing. Pick a public venue in Orbit.',
      new_venue_id,
      group_row.location,
      group_row.starts_at,
      group_row.starts_at + interval '90 minutes',
      2,
      6,
      greatest(now() + interval '5 minutes', group_row.starts_at - interval '10 minutes'),
      'open',
      'system'
    ) returning id into new_plan_id;

    insert into public.plan_interests (plan_id, interest_id)
    select new_plan_id, id from public.interests where slug = group_row.activity_type;

    update public.forming_groups set status = 'plan_created', plan_id = new_plan_id where id = p_group_id;
  end if;

  insert into public.plan_members (plan_id, user_id, role, status)
  values (new_plan_id, caller_id, case when group_row.plan_id is null then 'creator' else 'member' end, 'joined')
  on conflict (plan_id, user_id) do update set status = 'joined', left_at = null;

  update public.availability_intents set status = 'matched'
  where id = member_intent_id and user_id = caller_id and status = 'active';

  insert into public.plan_messages (plan_id, sender_id, message_type, body)
  select new_plan_id, null, 'system', 'It’s happening — HAO formed this plan from compatible Now intents.'
  where not exists (
    select 1 from public.plan_messages
    where plan_id = new_plan_id and message_type = 'system'
      and body = 'It’s happening — HAO formed this plan from compatible Now intents.'
  );

  return new_plan_id;
end;
$$;

revoke all on function public.get_my_forming_group(), public.create_forming_group(uuid), public.respond_to_forming_group(uuid, boolean) from public, anon;
grant execute on function public.get_my_forming_group(), public.create_forming_group(uuid), public.respond_to_forming_group(uuid, boolean) to authenticated;
