-- Run with a privileged analytics role. These queries never return birth dates.
-- Compare equal-length windows by changing :before_start, :launch_at and :after_end.

-- 1. Age prompt funnel by action.
select action, count(*) as events,
  count(distinct interaction_id) as interactions
from public.age_prompt_events
where created_at >= :launch_at and created_at < :after_end
group by action order by action;

-- 2. Confirmed / shown rate.
with funnel as (
  select interaction_id,
    bool_or(action = 'shown') as shown,
    bool_or(action = 'confirmed') as confirmed,
    bool_or(action = 'cancelled') as cancelled
  from public.age_prompt_events
  where created_at >= :launch_at and created_at < :after_end
  group by interaction_id
)
select count(*) filter (where shown) as shown,
  count(*) filter (where confirmed) as confirmed,
  count(*) filter (where cancelled) as cancelled,
  round(count(*) filter (where confirmed)::numeric / nullif(count(*) filter (where shown), 0), 4) as confirmed_per_shown
from funnel;

-- 3. Successful Meet rate by whether the host set a preference.
select (plan.preferred_age <> 'any') as has_age_preference,
  count(*) as completed_plans,
  count(meet.plan_id) as successful_meets,
  round(count(meet.plan_id)::numeric / nullif(count(*), 0), 4) as successful_meet_rate
from public.plans plan
left join public.successful_meets meet on meet.plan_id = plan.id
where plan.starts_at >= :launch_at and plan.starts_at < :after_end
  and plan.status = 'completed'
group by has_age_preference;

-- 4. Preference adoption among plans created after launch.
select count(*) filter (where preferred_age <> 'any') as plans_with_preference,
  count(*) as all_plans,
  round(count(*) filter (where preferred_age <> 'any')::numeric / nullif(count(*), 0), 4) as adoption_rate
from public.plans
where created_at >= :launch_at and created_at < :after_end;

-- 5. Pre/post Successful Meet rate. Segment further by city, activity, group size and start hour before drawing conclusions.
select period,
  count(*) as completed_plans,
  count(meet.plan_id) as successful_meets,
  round(count(meet.plan_id)::numeric / nullif(count(*), 0), 4) as successful_meet_rate
from (
  select plan.*, case when plan.starts_at < :launch_at then 'before' else 'after' end as period
  from public.plans plan
  where plan.starts_at >= :before_start and plan.starts_at < :after_end and plan.status = 'completed'
) plan
left join public.successful_meets meet on meet.plan_id = plan.id
group by period order by period;
