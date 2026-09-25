create or replace function public.cancel_plan(target_plan_id uuid)
returns public.plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_plan public.plans%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into target_plan
  from public.plans
  where id = target_plan_id
  for update;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  if target_plan.creator_id is distinct from caller_id then
    raise exception 'creator_required' using errcode = '42501';
  end if;
  if target_plan.status = 'cancelled' then
    return target_plan;
  end if;
  if target_plan.status = 'completed' then
    raise exception 'completed_plan_cannot_be_cancelled' using errcode = 'P0001';
  end if;

  update public.plans
  set status = 'cancelled'
  where id = target_plan_id
  returning * into target_plan;

  insert into public.plan_messages (plan_id, sender_id, message_type, body)
  values (target_plan_id, null, 'system', 'Plan cancelled by the host.');

  return target_plan;
end;
$$;

revoke all on function public.cancel_plan(uuid) from public, anon;
grant execute on function public.cancel_plan(uuid) to authenticated;
