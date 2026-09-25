insert into public.interests (slug, label)
values
  ('coffee', 'Coffee'), ('walk', 'Walk'), ('food', 'Food'), ('drink', 'Drink'),
  ('sport', 'Sport'), ('sunset', 'Sunset'), ('games', 'Games'), ('anything', 'Anything')
on conflict (slug) do update set label = excluded.label;

insert into public.ai_feature_limits
  (feature, enabled, daily_budget_usd, monthly_budget_usd, max_calls_per_user_per_day, model_key)
values
  ('translation', false, 10, 200, 100, 'translation_low_cost'),
  ('plan_title_generation', false, 2, 30, 20, 'generation_low_cost'),
  ('intent_grouping_ai', false, 0, 0, 0, 'reasoning_strong')
on conflict (feature) do update set
  enabled = excluded.enabled,
  daily_budget_usd = excluded.daily_budget_usd,
  monthly_budget_usd = excluded.monthly_budget_usd,
  max_calls_per_user_per_day = excluded.max_calls_per_user_per_day,
  model_key = excluded.model_key;
