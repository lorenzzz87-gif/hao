-- NOW V1 — Supabase/Postgres starter schema (AI cost-aware)
-- Assumes Supabase Auth and PostGIS.

create extension if not exists postgis;
create extension if not exists pgcrypto;

create type plan_status as enum (
  'draft','open','confirmed','full','started','completed','cancelled'
);
create type plan_source as enum ('user','system','merchant');
create type member_status as enum ('joined','left','removed','no_show');
create type report_status as enum ('open','reviewing','resolved','dismissed');
create type intent_status as enum ('active','matched','expired','cancelled');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  birth_date date,
  primary_language text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.interests (
  id bigserial primary key,
  slug text unique not null,
  label text not null
);

create table if not exists public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id bigint not null references public.interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);

create table if not exists public.profile_languages (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  language_code text not null,
  primary key (profile_id, language_code)
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  location geography(point, 4326),
  source text,
  external_place_id text,
  is_public_place boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists venues_location_gix
  on public.venues using gist(location);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  title text not null,
  note text,
  venue_id uuid references public.venues(id) on delete set null,
  location geography(point, 4326) not null,
  starts_at timestamptz not null,
  expected_end_at timestamptz,
  min_participants int not null default 2 check (min_participants >= 2),
  max_participants int not null default 4 check (max_participants >= min_participants),
  confirmation_deadline timestamptz,
  status plan_status not null default 'open',
  source plan_source not null default 'user',
  created_at timestamptz not null default now()
);

create index if not exists plans_location_gix
  on public.plans using gist(location);
create index if not exists plans_starts_at_idx
  on public.plans(starts_at);
create index if not exists plans_status_starts_idx
  on public.plans(status, starts_at);

create table if not exists public.plan_members (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('creator','member')),
  status member_status not null default 'joined',
  joined_at timestamptz not null default now(),
  checked_in_at timestamptz,
  left_at timestamptz,
  primary key (plan_id, user_id)
);

create index if not exists plan_members_user_idx
  on public.plan_members(user_id, status);

create table if not exists public.availability_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  location geography(point, 4326) not null,
  max_distance_m integer not null default 5000 check (max_distance_m > 0),
  status intent_status not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists availability_intents_location_gix
  on public.availability_intents using gist(location);
create index if not exists availability_intents_active_idx
  on public.availability_intents(status, expires_at);

create table if not exists public.intent_interests (
  intent_id uuid not null references public.availability_intents(id) on delete cascade,
  interest_id bigint not null references public.interests(id) on delete cascade,
  primary key(intent_id, interest_id)
);

create table if not exists public.plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  source_language text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists plan_messages_plan_created_idx
  on public.plan_messages(plan_id, created_at);

-- Unified translation cache.
-- source_hash changes when source content changes, preventing stale translations.
create table if not exists public.content_translations (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('plan_title','plan_note','message')),
  content_id uuid not null,
  source_language text,
  target_language text not null,
  source_hash text not null,
  translated_text text not null,
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique(content_type, content_id, target_language, source_hash)
);

create index if not exists content_translations_lookup_idx
  on public.content_translations(content_type, content_id, target_language, source_hash);

-- Server-side audit trail for every billable AI call.
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null,
  request_id text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  estimated_cost_usd numeric(14,8) not null default 0 check (estimated_cost_usd >= 0),
  latency_ms integer,
  cache_hit boolean not null default false,
  success boolean not null default true,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_created_idx
  on public.ai_usage_logs(created_at);
create index if not exists ai_usage_logs_feature_idx
  on public.ai_usage_logs(feature, created_at);
create index if not exists ai_usage_logs_plan_idx
  on public.ai_usage_logs(plan_id, created_at);
create index if not exists ai_usage_logs_user_idx
  on public.ai_usage_logs(user_id, created_at);

-- Server-controlled AI feature flags and budget guards.
create table if not exists public.ai_feature_limits (
  feature text primary key,
  enabled boolean not null default true,
  daily_budget_usd numeric(12,4),
  monthly_budget_usd numeric(12,4),
  max_calls_per_user_per_day integer,
  model_key text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','plan','message')),
  target_id uuid not null,
  reason text not null,
  details text,
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.device_push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  token text not null,
  last_seen_at timestamptz not null default now(),
  primary key(user_id, token)
);

insert into public.interests (slug, label)
values
  ('coffee','Coffee'),
  ('walk','Walk'),
  ('food','Food'),
  ('drink','Drink'),
  ('sport','Sport'),
  ('sunset','Sunset'),
  ('games','Games'),
  ('anything','Anything')
on conflict (slug) do nothing;

insert into public.ai_feature_limits
  (feature, enabled, daily_budget_usd, monthly_budget_usd, max_calls_per_user_per_day, model_key)
values
  ('translation', true, 10, 200, 100, 'translation_low_cost'),
  ('plan_title_generation', true, 2, 30, 20, 'generation_low_cost'),
  ('intent_grouping_ai', false, 0, 0, 0, 'reasoning_strong')
on conflict (feature) do nothing;

-- RLS, RPC and Edge Functions are intentionally next-step work.
-- Critical next functions:
-- 1) discover_nearby_plans
-- 2) join_plan (atomic capacity check)
-- 3) create_availability_intent
-- 4) find_compatible_intents
-- 5) check_in
-- 6) translate_content through server-side AI gateway
-- 7) budget_guard for ai_feature_limits
