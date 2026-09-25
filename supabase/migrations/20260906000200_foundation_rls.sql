alter table public.profiles enable row level security;
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.profile_languages enable row level security;
alter table public.venues enable row level security;
alter table public.plans enable row level security;
alter table public.plan_interests enable row level security;
alter table public.plan_members enable row level security;
alter table public.availability_intents enable row level security;
alter table public.intent_interests enable row level security;
alter table public.plan_messages enable row level security;
alter table public.content_translations enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_feature_limits enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.successful_meets enable row level security;

grant select (id, display_name, avatar_url, primary_language, onboarding_completed, created_at) on public.profiles to authenticated;
grant update (display_name, avatar_url, birth_date, primary_language, onboarding_completed) on public.profiles to authenticated;
grant select on public.interests, public.venues, public.plans, public.plan_interests to authenticated;
grant select, insert, delete on public.profile_interests, public.profile_languages to authenticated;
grant select on public.plan_members, public.plan_messages to authenticated;
grant insert (plan_id, sender_id, message_type, body, source_language) on public.plan_messages to authenticated;
grant select, insert, update on public.availability_intents to authenticated;
grant select, insert, delete on public.intent_interests to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant insert on public.reports to authenticated;
grant select, insert, update, delete on public.device_push_tokens to authenticated;

create or replace function private.is_plan_member(target_plan_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plan_members
    where plan_id = target_plan_id and user_id = target_user_id and status = 'joined'
  );
$$;

create or replace function private.is_blocked_pair(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = first_user_id and blocked_id = second_user_id)
       or (blocker_id = second_user_id and blocked_id = first_user_id)
  );
$$;

revoke execute on function private.is_plan_member(uuid, uuid) from public;
revoke execute on function private.is_blocked_pair(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_plan_member(uuid, uuid) to authenticated;
grant execute on function private.is_blocked_pair(uuid, uuid) to authenticated;

create policy profiles_read_authenticated on public.profiles for select to authenticated
using ((select auth.uid()) is not null and not is_suspended);
create policy profiles_update_self on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy interests_read on public.interests for select to authenticated using (true);
create policy venues_read on public.venues for select to authenticated using (true);

create policy profile_interests_read on public.profile_interests for select to authenticated using (true);
create policy profile_interests_insert_self on public.profile_interests for insert to authenticated
with check ((select auth.uid()) = profile_id);
create policy profile_interests_delete_self on public.profile_interests for delete to authenticated
using ((select auth.uid()) = profile_id);

create policy profile_languages_read_self on public.profile_languages for select to authenticated
using ((select auth.uid()) = profile_id);
create policy profile_languages_insert_self on public.profile_languages for insert to authenticated
with check ((select auth.uid()) = profile_id);
create policy profile_languages_delete_self on public.profile_languages for delete to authenticated
using ((select auth.uid()) = profile_id);

create policy plans_read_discoverable on public.plans for select to authenticated
using (
  status in ('open', 'confirmed', 'full')
  and starts_at <= now() + interval '6 hours'
  and (creator_id is null or not (select private.is_blocked_pair(auth.uid(), creator_id)))
);
create policy plans_read_members on public.plans for select to authenticated
using (creator_id = (select auth.uid()) or (select private.is_plan_member(id)));
create policy plan_interests_read on public.plan_interests for select to authenticated
using (exists (select 1 from public.plans p where p.id = plan_id));

create policy plan_members_read_members on public.plan_members for select to authenticated
using ((select private.is_plan_member(plan_id)));

create policy intents_read_self on public.availability_intents for select to authenticated
using ((select auth.uid()) = user_id);
create policy intents_insert_self on public.availability_intents for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy intents_update_self on public.availability_intents for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy intent_interests_read_self on public.intent_interests for select to authenticated
using (exists (select 1 from public.availability_intents i where i.id = intent_id and i.user_id = (select auth.uid())));
create policy intent_interests_insert_self on public.intent_interests for insert to authenticated
with check (exists (select 1 from public.availability_intents i where i.id = intent_id and i.user_id = (select auth.uid())));
create policy intent_interests_delete_self on public.intent_interests for delete to authenticated
using (exists (select 1 from public.availability_intents i where i.id = intent_id and i.user_id = (select auth.uid())));

create policy messages_read_members on public.plan_messages for select to authenticated
using ((select private.is_plan_member(plan_id)));
create policy messages_insert_members on public.plan_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and message_type in ('text', 'quick_action')
  and (select private.is_plan_member(plan_id))
);

create policy blocks_read_self on public.blocks for select to authenticated
using ((select auth.uid()) in (blocker_id, blocked_id));
create policy blocks_insert_self on public.blocks for insert to authenticated
with check ((select auth.uid()) = blocker_id);
create policy blocks_delete_self on public.blocks for delete to authenticated
using ((select auth.uid()) = blocker_id);

create policy reports_insert_self on public.reports for insert to authenticated
with check ((select auth.uid()) = reporter_id);

create policy push_tokens_self on public.device_push_tokens for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.content_translations, public.ai_usage_logs, public.ai_feature_limits, public.successful_meets from anon, authenticated;
