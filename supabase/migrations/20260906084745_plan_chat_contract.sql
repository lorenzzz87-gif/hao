create type public.plan_chat_summary as (
  plan_id uuid,
  title text,
  starts_at timestamptz,
  status public.plan_status,
  last_message text,
  last_message_at timestamptz
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
    and not exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.is_suspended)
  order by coalesce(latest.created_at, plan.created_at) desc;
$$;

revoke all on function public.get_my_plan_chats() from public, anon;
grant execute on function public.get_my_plan_chats() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_messages'
  ) then
    alter publication supabase_realtime add table public.plan_messages;
  end if;
end;
$$;
