-- Privacy, account lifecycle, and UGC safety hardening.

alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists identity_verification_status text not null default 'unverified'
    check (identity_verification_status in ('unverified', 'pending', 'verified', 'failed'));

alter table public.reports
  add column if not exists moderation_due_at timestamptz not null default (now() + interval '24 hours');
create index if not exists reports_moderation_due_idx
  on public.reports(moderation_due_at) where status in ('open', 'reviewing');

create or replace function private.approximate_public_location(value extensions.geography)
returns extensions.geography
language sql
immutable
set search_path = ''
as $$
  select extensions.st_setsrid(
    extensions.st_snaptogrid(value::extensions.geometry, 0.004),
    4326
  )::extensions.geography;
$$;
revoke all on function private.approximate_public_location(extensions.geography) from public, anon, authenticated;

create or replace function private.approximate_plan_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.location := private.approximate_public_location(new.location);
  return new;
end;
$$;
revoke all on function private.approximate_plan_location() from public, anon, authenticated;

drop trigger if exists plans_approximate_location on public.plans;
create trigger plans_approximate_location before insert or update of location on public.plans
for each row execute function private.approximate_plan_location();

create or replace function private.approximate_venue_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.external_place_id is null then
    new.location := private.approximate_public_location(new.location);
  end if;
  return new;
end;
$$;
revoke all on function private.approximate_venue_location() from public, anon, authenticated;

drop trigger if exists venues_approximate_location on public.venues;
create trigger venues_approximate_location before insert or update of location on public.venues
for each row execute function private.approximate_venue_location();

-- Sanitize existing user-entered points. Verified external POIs remain exact.
update public.venues
set location = private.approximate_public_location(location)
where external_place_id is null;
update public.plans
set location = private.approximate_public_location(location);

create or replace function private.moderate_ugc()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized text := lower(coalesce(new.body, ''));
begin
  -- A deliberately small baseline list; production moderation should add a provider and human review.
  if normalized ~ '(kill yourself|kys|nazi|stupro|ammazzati|强奸|去死)' then
    raise exception 'content_not_allowed' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.moderate_ugc() from public, anon, authenticated;
drop trigger if exists plan_messages_moderate_ugc on public.plan_messages;
create trigger plan_messages_moderate_ugc before insert or update of body on public.plan_messages
for each row when (new.message_type in ('text', 'quick_action')) execute function private.moderate_ugc();

create or replace function public.accept_community_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_version <> '2026-09-24' then raise exception 'invalid_terms_version' using errcode = '22023'; end if;
  update public.profiles
  set terms_version = p_version, terms_accepted_at = now()
  where id = auth.uid() and not is_suspended;
  if not found then raise exception 'profile_unavailable' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.accept_community_terms(text) from public, anon;
grant execute on function public.accept_community_terms(text) to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  delete from auth.users where id = caller_id;
  if not found then raise exception 'account_not_found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.review_report(p_report_id uuid, p_status public.report_status)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare result public.reports%rowtype;
begin
  if auth.uid() is null
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderator_required' using errcode = '42501';
  end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_report_status' using errcode = '22023';
  end if;
  update public.reports set status = p_status,
    reviewed_at = case when p_status in ('resolved', 'dismissed') then now() else reviewed_at end,
    reviewed_by = auth.uid()
  where id = p_report_id returning * into result;
  if not found then raise exception 'report_not_found' using errcode = 'P0002'; end if;
  return result;
end;
$$;
revoke all on function public.review_report(uuid, public.report_status) from public, anon;
grant execute on function public.review_report(uuid, public.report_status) to authenticated;

-- Trust context for plan members. It exposes counts and badges, never private profile fields.
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
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then raise exception 'account_suspended' using errcode = '42501'; end if;

  select * into target_plan from public.plans where id = target_plan_id;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  if not ((target_plan.status in ('open', 'confirmed', 'full') and target_plan.starts_at between now() and now() + interval '6 hours') or target_plan.creator_id = caller_id or private.is_plan_member(target_plan_id, caller_id)) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.plan_members pm where pm.plan_id = target_plan_id and pm.status = 'joined' and private.is_blocked_pair(caller_id, pm.user_id)) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  select * into target_venue from public.venues where id = target_plan.venue_id;
  select * into caller_membership from public.plan_members where plan_id = target_plan_id and user_id = caller_id and status = 'joined';

  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id', profile.id,
    'display_name', profile.display_name,
    'avatar_url', profile.avatar_url,
    'role', member.role,
    'phone_verified', exists (select 1 from auth.users account where account.id = profile.id and account.phone_confirmed_at is not null),
    'identity_verified', profile.identity_verification_status = 'verified',
    'common_interests', (select count(*) from public.profile_interests theirs join public.profile_interests mine on mine.interest_id = theirs.interest_id and mine.profile_id = caller_id where theirs.profile_id = profile.id),
    'successful_meets', (select count(*) from public.plan_members history join public.successful_meets meet on meet.plan_id = history.plan_id where history.user_id = profile.id and history.checked_in_at is not null)
  ) order by member.joined_at), '[]'::jsonb)
  into active_count, member_payload
  from public.plan_members member
  join public.profiles profile on profile.id = member.user_id
  where member.plan_id = target_plan_id and member.status = 'joined' and not profile.is_suspended;

  return jsonb_build_object(
    'id', target_plan.id, 'creator_id', target_plan.creator_id, 'title', target_plan.title,
    'note', target_plan.note, 'activity_type', target_plan.activity_type, 'starts_at', target_plan.starts_at,
    'expected_end_at', target_plan.expected_end_at, 'status', target_plan.status,
    'min_participants', target_plan.min_participants, 'max_participants', target_plan.max_participants,
    'joined_count', active_count, 'seats_remaining', greatest(0, target_plan.max_participants - active_count),
    'is_joined', caller_membership.user_id is not null, 'is_creator', target_plan.creator_id = caller_id,
    'venue', jsonb_build_object('id', target_venue.id, 'name', target_venue.name, 'address', target_venue.address,
      'latitude', extensions.st_y(target_plan.location::extensions.geometry),
      'longitude', extensions.st_x(target_plan.location::extensions.geometry),
      'is_public_place', target_venue.is_public_place, 'is_approximate', target_venue.external_place_id is null),
    'members', member_payload
  );
end;
$$;
revoke all on function public.get_plan_detail(uuid) from public, anon;
grant execute on function public.get_plan_detail(uuid) to authenticated;
