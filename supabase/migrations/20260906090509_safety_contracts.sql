create or replace function public.block_user(target_user_id uuid)
returns public.blocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  result public.blocks%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if target_user_id is null or target_user_id = caller_id then raise exception 'invalid_block_target' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then raise exception 'account_suspended' using errcode = '42501'; end if;
  if not exists (
    select 1
    from public.plan_members caller_member
    join public.plan_members target_member on target_member.plan_id = caller_member.plan_id
    where caller_member.user_id = caller_id and caller_member.status = 'joined'
      and target_member.user_id = target_user_id and target_member.status = 'joined'
  ) then raise exception 'block_target_not_found' using errcode = 'P0002'; end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (caller_id, target_user_id)
  on conflict (blocker_id, blocked_id) do update set created_at = public.blocks.created_at
  returning * into result;
  return result;
end;
$$;

create or replace function public.report_target(
  target_kind text,
  target_id uuid,
  report_reason text,
  report_details text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_plan_id uuid;
  result public.reports%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = caller_id and is_suspended) then raise exception 'account_suspended' using errcode = '42501'; end if;
  if target_kind not in ('user', 'plan', 'message') or target_id is null then raise exception 'invalid_report_target' using errcode = '22023'; end if;
  if report_reason not in ('harassment', 'hate_or_abuse', 'unsafe_meetup', 'spam_or_scam', 'other') then raise exception 'invalid_report_reason' using errcode = '22023'; end if;
  if report_details is not null and char_length(btrim(report_details)) > 1000 then raise exception 'report_details_too_long' using errcode = '22001'; end if;
  if (select count(*) from public.reports where reporter_id = caller_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'report_rate_limited' using errcode = 'P0001';
  end if;

  if target_kind = 'plan' then
    target_plan_id := target_id;
    if not exists (select 1 from public.plans where id = target_id) then raise exception 'report_target_not_found' using errcode = 'P0002'; end if;
  elsif target_kind = 'message' then
    select plan_id into target_plan_id from public.plan_messages where id = target_id;
    if target_plan_id is null or not private.is_plan_member(target_plan_id, caller_id) then raise exception 'report_target_not_found' using errcode = 'P0002'; end if;
  else
    if target_id = caller_id or not exists (
      select 1 from public.plan_members caller_member
      join public.plan_members target_member on target_member.plan_id = caller_member.plan_id
      where caller_member.user_id = caller_id and caller_member.status = 'joined'
        and target_member.user_id = target_id and target_member.status = 'joined'
    ) then raise exception 'report_target_not_found' using errcode = 'P0002'; end if;
  end if;

  if target_kind = 'plan' and not (
    private.is_plan_member(target_plan_id, caller_id)
    or exists (select 1 from public.plans where id = target_plan_id and status in ('open', 'confirmed', 'full') and starts_at between now() and now() + interval '6 hours')
  ) then raise exception 'report_target_not_found' using errcode = 'P0002'; end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (caller_id, target_kind, target_id, report_reason, nullif(btrim(report_details), ''))
  returning * into result;
  return result;
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.report_target(text, uuid, text, text) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.report_target(text, uuid, text, text) to authenticated;

revoke insert on public.blocks from authenticated;
revoke insert on public.reports from authenticated;

drop policy profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles for select to authenticated
using (
  (select auth.uid()) is not null
  and not is_suspended
  and (id = (select auth.uid()) or not (select private.is_blocked_pair(auth.uid(), id)))
);

drop policy plan_members_read_members on public.plan_members;
create policy plan_members_read_members on public.plan_members for select to authenticated
using (
  (select private.is_plan_member(plan_id))
  and (user_id = (select auth.uid()) or not (select private.is_blocked_pair(auth.uid(), user_id)))
);

drop policy messages_read_members on public.plan_messages;
create policy messages_read_members on public.plan_messages for select to authenticated
using (
  (select private.is_plan_member(plan_id))
  and (message_type = 'system' or sender_id is null or sender_id = (select auth.uid()) or not (select private.is_blocked_pair(auth.uid(), sender_id)))
);

create or replace function public.get_my_plan_chats()
returns setof public.plan_chat_summary
language sql
stable
security definer
set search_path = ''
as $$
  select
    plan.id,
    plan.title,
    plan.starts_at,
    plan.status,
    latest.body,
    latest.created_at
  from public.plan_members membership
  join public.plans plan on plan.id = membership.plan_id
  left join lateral (
    select message.body, message.created_at
    from public.plan_messages message
    where message.plan_id = plan.id and message.deleted_at is null
    order by message.created_at desc
    limit 1
  ) latest on true
  where auth.uid() is not null
    and membership.user_id = auth.uid()
    and membership.status = 'joined'
    and not exists (
      select 1 from public.plan_members blocked_member
      where blocked_member.plan_id = plan.id and blocked_member.status = 'joined'
        and private.is_blocked_pair(auth.uid(), blocked_member.user_id)
    )
    and not exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.is_suspended)
  order by coalesce(latest.created_at, plan.created_at) desc;
$$;
