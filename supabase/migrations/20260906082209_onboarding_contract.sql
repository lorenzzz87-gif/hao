create or replace function public.complete_onboarding(
  display_name text,
  birth_date date,
  primary_language text,
  interest_slugs text[]
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  selected_count integer;
  updated_profile public.profiles%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if nullif(btrim(display_name), '') is null or char_length(btrim(display_name)) > 60 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  if birth_date is null or birth_date > current_date - interval '18 years' then
    raise exception 'must_be_18_or_older' using errcode = '22023';
  end if;
  if primary_language not in ('en', 'it', 'zh') then
    raise exception 'unsupported_language' using errcode = '22023';
  end if;

  select count(distinct i.slug) into selected_count
  from public.interests i
  where i.slug = any(interest_slugs);
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

  if not found then
    raise exception 'profile_unavailable' using errcode = '42501';
  end if;

  delete from public.profile_languages where profile_id = caller_id;
  insert into public.profile_languages (profile_id, language_code)
  values (caller_id, complete_onboarding.primary_language);

  delete from public.profile_interests where profile_id = caller_id;
  insert into public.profile_interests (profile_id, interest_id)
  select caller_id, i.id from public.interests i where i.slug = any(interest_slugs);

  return updated_profile;
end;
$$;

revoke all on function public.complete_onboarding(text, date, text, text[]) from public, anon;
grant execute on function public.complete_onboarding(text, date, text, text[]) to authenticated;
