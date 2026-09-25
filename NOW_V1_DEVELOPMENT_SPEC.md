# NOW — V1 Development Spec (AI Cost-Aware Edition)

> Working title: **NOW**
> Product thesis: turn a few free hours into a real-world plan nearby.
> North-star metric: **Successful Meets** — plans that actually happen with at least 2 checked-in participants.
> Engineering principle: **AI understands and judges; deterministic systems calculate and execute.**

---

## 1. V1 Goal

V1 is not a full social network, not a dating app, and not an AI chatbot.

It must validate one thing:

> Can a user open the app, discover or create a nearby plan, join it, and actually meet someone offline within the next few hours?

### V1 success metrics

- Activation: user sees at least 1 relevant plan or viable forming-plan state in first session.
- Join conversion: plan detail -> join.
- Formation rate: created plan reaches minimum participant threshold.
- Show-up rate: joined user checks in.
- Repeat rate: user joins or creates another plan within 14 days.
- North star: weekly Successful Meets.
- Cost guardrail: AI cost per Successful Meet.

---

## 2. Product Principle

### 2.1 What AI should do

AI is reserved for tasks that benefit from language understanding, semantic judgment or generation:

- translation of plan text and chat messages
- optional plan-title generation
- later: semantic grouping of ambiguous intents
- later: selecting among multiple candidate group formations
- optional safety-assistance after deterministic moderation signals

### 2.2 What AI should NOT do

The following must be deterministic and inexpensive:

- distance calculations
- geographic filtering
- time overlap
- plan capacity
- plan status transitions
- nearby-plan ranking baseline
- basic interest matching
- joining/leaving plans
- check-in logic
- push scheduling
- block/report enforcement
- availability expiration
- candidate intent clustering

### 2.3 AI architecture rule

Use three levels:

**Level 0 — No AI**
- target: 80–90% of product operations
- PostgreSQL/PostGIS, application logic, Edge Functions

**Level 1 — Low-cost AI**
- translation
- short classification
- short generation
- language normalization
- cached outputs whenever possible

**Level 2 — Strong AI**
- only when deterministic candidate generation is already complete
- complex group-selection or ambiguous social-context reasoning
- not required for V1 launch

---

## 3. Core Product Scope

### Included

1. **I'm Free**
   - duration: 30m / 1h / 2h / Tonight
   - interests: Coffee / Walk / Food / Drink / Sport / Sunset / Games / Anything
   - stores temporary intent for matching/recommendations
   - no AI call on creation

2. **Now Feed**
   - ranked nearby plans happening within next 6 hours
   - deterministic ranking first
   - default home screen
   - not a social feed

3. **Map**
   - only shows plans, not live people
   - pin displays category + start time + remaining seats
   - filters: Now / Today / Tonight

4. **Create Plan**
   - activity type
   - start time
   - venue/location
   - max participants
   - optional note
   - target creation time: under 20 seconds
   - AI title generation optional, never required

5. **Join Plan**
   - one tap join
   - atomic server-side capacity check
   - immediate access to plan chat

6. **Plan Chat**
   - real-time messages
   - quick replies:
     - I'm on my way
     - I'm here
     - I'll be 5 min late
     - Can't make it

7. **Translation**
   - on-demand translation, not automatic for every message
   - translate plan title, note and chat message
   - cache by source content + target language
   - repeated views must not trigger repeated AI calls

8. **Safety**
   - 18+ only
   - block user
   - report user / plan / message
   - public-place recommendation
   - no exact live user location
   - admin report review queue
   - moderation pipeline can use non-billable/free moderation where available

9. **Check-in**
   - manual "I'm here"
   - optional geofence validation
   - used to calculate Successful Meets

10. **Profile**
   - display name
   - avatar
   - birth date / age gate
   - languages
   - interests
   - joined plans count

11. **AI Cost Observability**
   - every billable AI call logged
   - model/provider/function/tokens/estimated cost tracked
   - link AI usage to user and plan where possible
   - dashboard metrics:
     - total AI cost
     - translation cost
     - AI cost per MAU
     - AI cost per plan
     - AI cost per Successful Meet

---

## 4. Explicitly Out of Scope for V1

- followers
- likes
- public social feed
- stories
- dating swipes
- direct messaging strangers
- events weeks/months in advance
- full AI personality matching
- AI chatbot companion
- AI call per availability intent
- merchant paid promotions
- dynamic surge pricing
- public user ratings
- precise live-location tracking
- group management / communities
- complex calendar
- automatic AI-created plans as a launch dependency

---

## 5. Navigation

Bottom tabs:

1. **Now**
2. **Map**
3. **+**
4. **Chats**
5. **Me**

Primary action on Now screen:

> **I'm Free**

---

## 6. Main User Flows

### Flow A — First launch

1. Sign in with Apple / Google / phone
2. Age gate: 18+
3. Choose languages
4. Choose 3–5 interests
5. Ask location permission
6. Enter Now screen
7. Show nearby plans or a truthful empty-state intent prompt

### Flow B — I'm Free

1. Tap I'm Free
2. Choose duration
3. Choose one or more activity interests
4. Save availability intent
5. Deterministically query nearby plans
6. Rank by time + distance + interest overlap
7. If none exist:
   - show create-plan CTA
   - show forming state only if sufficient real compatible intents exist

No AI call is required in this flow.

### Flow C — Join plan

1. Open plan card
2. Review activity/time/distance/venue/seats/participants
3. Join via atomic RPC
4. Enter plan chat
5. Receive reminders
6. Check in
7. Optional lightweight feedback after completion

### Flow D — Create plan

1. Activity type
2. When
3. Suggested public venue
4. Group size
5. Optional note
6. Create
7. Optional low-cost AI generates polished title if user did not supply one
8. Plan opens in open/confirmed state

### Flow E — Plan confirmation

Each plan has:
- min_participants
- max_participants
- confirmation_deadline

If minimum reached before deadline:
- status -> confirmed
- push participants

If deadline passes:
- status -> cancelled
- deterministically suggest alternatives

### Flow F — Translate

1. User taps Translate on title/note/message
2. Check translation cache
3. If cached -> return immediately, cost = 0
4. If missing -> call low-cost model
5. Store translation and usage log
6. Return translated text

---

## 7. Plan Status Model

- draft
- open
- confirmed
- full
- started
- completed
- cancelled

Rules:
- `open`: joinable, min participants not yet reached
- `confirmed`: min participants reached
- `full`: max participants reached
- `started`: start time reached
- `completed`: end window passed
- `cancelled`: creator/system cancelled or confirmation failed

---

## 8. Recommended Tech Stack

### Mobile
- React Native
- Expo
- TypeScript
- Expo Router
- TanStack Query
- Zustand for local UI state

### Backend
- Supabase
  - Auth
  - PostgreSQL
  - PostGIS
  - Realtime
  - Storage
  - Edge Functions
  - Row Level Security

### Maps
V1:
- `react-native-maps`
- native Apple Maps on iOS
- Google Maps on Android

Product geography remains in PostGIS. Map providers render; they do not own matching logic.

### Push
- Expo Notifications

### Admin
- Next.js
- Supabase admin APIs
- report queue
- user moderation
- AI usage/cost dashboard

### Analytics
- PostHog or equivalent
- event-first instrumentation from day one

### AI Gateway Layer
All AI requests go through one server-side service/Edge Function abstraction.

Never call model providers directly from the mobile client.

Responsibilities:
- provider/model routing
- token counting
- request caps
- caching
- retries
- cost estimation
- usage logging
- feature flags
- kill switch per AI feature

---

## 9. Core Database Model

### profiles
- id UUID PK -> auth.users
- display_name
- avatar_url
- birth_date
- primary_language
- created_at
- onboarding_completed

### profile_languages
- profile_id
- language_code

### interests
- id
- slug
- label

### profile_interests
- profile_id
- interest_id

### availability_intents
Temporary intent created by I'm Free.

- id
- user_id
- starts_at
- expires_at
- location geography(Point,4326)
- max_distance_m
- status
- created_at

Raw intent location is private.

### intent_interests
- intent_id
- interest_id

### venues
- id
- name
- address
- location geography(Point,4326)
- source
- external_place_id
- is_public_place

### plans
- id
- creator_id nullable
- activity_type
- title
- note
- venue_id nullable
- location geography(Point,4326)
- starts_at
- expected_end_at
- min_participants
- max_participants
- confirmation_deadline
- status
- source: user / system / merchant
- created_at

### plan_members
- plan_id
- user_id
- role
- status
- joined_at
- checked_in_at
- left_at

### plan_messages
- id
- plan_id
- sender_id
- body
- source_language
- created_at
- deleted_at

### content_translations
Reusable cache for plan titles, notes and chat messages.

- id
- content_type: plan_title / plan_note / message
- content_id
- source_language
- target_language
- source_hash
- translated_text
- provider
- model
- created_at
- unique(content_type, content_id, target_language, source_hash)

### ai_usage_logs
Every billable AI call.

- id
- user_id nullable
- plan_id nullable
- feature
- provider
- model
- request_id nullable
- input_tokens
- output_tokens
- cached_input_tokens nullable
- estimated_cost_usd
- latency_ms
- cache_hit
- success
- error_code nullable
- created_at

### ai_feature_limits
Server-controlled budget and feature gates.

- feature PK
- enabled
- daily_budget_usd nullable
- monthly_budget_usd nullable
- max_calls_per_user_per_day nullable
- model_key
- updated_at

### blocks
- blocker_id
- blocked_id
- created_at

### reports
- id
- reporter_id
- target_type
- target_id
- reason
- details
- status
- created_at
- reviewed_at
- reviewed_by

### device_push_tokens
- user_id
- provider
- token
- last_seen_at

---

## 10. Geographic Discovery

Use PostGIS.

Default discovery:
- radius: 5 km
- plan start: now -> next 6 hours
- status: open / confirmed / full
- exclude blocked users
- exclude cancelled/started plans

V1 ranking:

```text
score =
  time_score * 0.45
+ distance_score * 0.35
+ interest_match * 0.20
```

No model call.

Later we may add reliability/language signals without requiring AI.

---

## 11. Intent Clustering — Non-AI First

When a user creates an availability intent:

1. write intent to database
2. query active compatible intents
3. require overlapping availability window
4. require geographic threshold
5. require at least one compatible interest, unless Anything
6. cluster candidates deterministically

Example candidate rule:
- >= 3 users
- <= 2 km cluster diameter
- >= 45 min common time window
- shared activity category

Then show:

> 3 people nearby are up for coffee around 18:00. Interested?

No AI is needed to create this candidate.

### Later AI enhancement

Only after multiple viable candidate groupings exist, Level 2 AI may select the most natural grouping or venue suggestion.

Candidate generation must always happen before AI.

---

## 12. Translation Architecture

Translation is the main expected recurring AI cost in V1.

Rules:

1. detect/store source language once where practical
2. translation is on-demand by default
3. hash source text
4. look for `(content_id, target_language, source_hash)` cache
5. call model only on cache miss
6. save translated result
7. log actual/estimated token usage and cost

### Never do this
- translate every message into every supported language at send time
- retranslate when user reopens chat
- send entire chat history for single-message translation

### Do this
- translate only requested content
- send only required text + minimal instruction
- reuse identical target-language translation

---

## 13. AI Cost Controls

### Hard controls

- AI calls only from backend
- every AI feature has an `enabled` flag
- per-user daily call caps
- global daily/monthly budget guards
- timeout and retry limits
- no recursive agent loops
- no arbitrary user prompt forwarded to expensive models

### Cost dashboard

Admin must be able to see:

- AI spend today
- AI spend this month
- cost by feature
- cost by model
- cost by plan
- cost by active user
- cost per Successful Meet
- cache hit rate
- error rate

### Budget response

When a non-critical AI budget is exhausted:
- translation may fall back to a cheaper configured model/provider if allowed
- optional generation is disabled
- core join/map/chat/check-in functionality must continue working

The app must never become unusable because AI budget is exhausted.

---

## 14. Empty-State Logic

An empty map is fatal.

Never show only:

> No plans nearby.

Instead use truthful states:

### State A
"No plans yet. 4 people nearby are free tonight."

CTA: Start a plan

### State B
"Coffee is forming nearby."

CTA: I'm interested

Only show when real compatible intent threshold is met.

### State C
"Be the first plan in this area."

CTA: Create in 20 seconds

Never fabricate users, participants, seats or plans.

---

## 15. Chat Rules

Chat exists only inside joined plans in V1.

No stranger DM.

Message types:
- text
- system
- quick_action

System messages:
- plan confirmed
- venue updated
- participant joined
- participant left
- reminder
- plan cancelled

Realtime:
- Supabase Realtime

Translation is a separate on-demand action and does not alter original content.

---

## 16. Notification Rules

Important push events:
- compatible nearby plan created
- plan confirmed
- plan almost full
- 30 min before start
- 10 min before start
- venue changed
- cancellation
- new group chat message
- forming plan reaches threshold

Avoid generic engagement spam.

No AI required to compose standard push messages in V1.

---

## 17. Safety Rules for V1

### Hard rules
- 18+ only
- no live people pins
- no exact current location sharing
- hide blocked users from all mutual discovery
- block removes mutual visibility
- reports create moderation queue
- first-meet venue recommendations prioritize public places
- no photo-based hot-or-not ranking
- no public follower count

### Moderation

Use deterministic rules and provider moderation endpoints where suitable.

Do not send every message to a high-cost generative model for safety screening.

Human review remains authoritative for reports and bans.

---

## 18. Analytics Events

Track from day one:

- onboarding_started
- onboarding_completed
- location_permission_granted
- now_viewed
- map_viewed
- im_free_started
- availability_created
- plan_viewed
- plan_created
- plan_joined
- plan_left
- plan_confirmed
- chat_message_sent
- translation_requested
- translation_cache_hit
- ai_call_started
- ai_call_succeeded
- ai_call_failed
- reminder_opened
- checkin_completed
- plan_completed
- report_submitted
- block_created

Derived:
- plan_fill_rate
- confirm_rate
- show_up_rate
- successful_meet_rate
- repeat_14d
- ai_cost_per_mau
- ai_cost_per_plan
- ai_cost_per_successful_meet
- translation_cache_hit_rate

---

## 19. Successful Meet Definition

A plan counts as a Successful Meet when:

- status = completed
- at least 2 distinct members checked in
- check-in happens within accepted time/location window

Later optional post-event feedback can strengthen confidence.

---

## 20. Development Order

### Sprint 0 — Foundation
- repo
- Expo app
- Supabase project
- environments
- auth
- navigation
- database migrations
- RLS baseline
- analytics baseline
- AI gateway skeleton
- AI feature flags + usage log

### Sprint 1 — Profiles + Map
- onboarding
- profile
- location permission
- PostGIS
- map
- nearby plan query

### Sprint 2 — Plans
- create plan
- plan detail
- atomic join/leave
- capacity
- status transitions

### Sprint 3 — Chat + Push
- realtime chat
- system messages
- push tokens
- plan reminders
- confirmation notification

### Sprint 4 — Check-in + Successful Meet
- check-in
- optional geofence
- completion rules
- north-star analytics

At this point the first vertical slice is complete.

### Sprint 5 — I'm Free
- availability intents
- deterministic recommendation query
- Now feed
- intent clustering
- truthful empty states

### Sprint 6 — Translation + AI Cost Controls
- translation gateway
- translation cache
- usage logs
- cost estimator
- per-feature budgets
- admin AI-cost dashboard

### Sprint 7 — Safety + Release Polish
- block
- report
- admin moderation queue
- deep links
- UX polish
- crash/error monitoring
- release candidate

### Post-V1
- AI-assisted cluster selection
- AI-generated plans
- merchant-hosted plans
- richer reliability modeling

---

## 21. First RPC / Server Surface

Deterministic:
- `discover_nearby_plans(lat, lng, radius_m, from_ts, to_ts)`
- `create_plan(...)`
- `join_plan(plan_id)`
- `leave_plan(plan_id)`
- `create_availability_intent(...)`
- `recommend_plans_for_intent(intent_id)`
- `find_compatible_intents(intent_id)`
- `check_in(plan_id, lat, lng)`
- `report_target(...)`
- `block_user(user_id)`

AI gateway:
- `translate_content(content_type, content_id, target_language)`
- `generate_plan_title(plan_id)` optional

Do not expose raw model API keys to clients.

---

## 22. RLS Principles

Users may:
- read public/open plans
- read limited public profile fields
- read messages only for plans they joined
- create/update their own profile
- create/manage their own plans
- join/leave eligible plans
- create their own reports
- read only their own private availability intents

Users may not:
- read another user's raw availability location
- read private moderation data
- read chats of plans they did not join
- modify another user's membership
- bypass blocked relationships
- read another user's AI usage details

AI usage logs and feature budgets are service-role/admin only.

---

## 23. Important Product Decisions Locked for V1

- Home is **Now**, not Map.
- Main CTA is **I'm Free**.
- Map shows plans, never live people.
- Plans focus on next **6 hours**.
- No followers, likes or public feed.
- No stranger DM in V1.
- Join is free in V1.
- Do not paywall participation during cold start.
- Nearby recommendation is deterministic first.
- Availability clustering is deterministic first.
- AI translation is on-demand and cached.
- No AI call per user intent.
- No AI call per map refresh.
- Full automatic AI group formation waits for real density data.
- Every billable AI call is measurable.
- Core product keeps working if AI is disabled.
- North-star metric is **Successful Meets**, not DAU.

---

## 24. First Release Geography

Do not launch nationwide.

Choose one dense test area.

Recommended test strategy:
- one walkable city / district
- manually seed first plans
- recruit 50–200 test users
- force most activity into narrow time windows
- measure whether plans actually fill
- separately measure AI cost per real-world meet

The launch problem is density, not downloads and not model intelligence.

---

## 25. Codex Build Instruction

Build V1 in vertical slices. Do not scaffold every future feature.

Priority order:

1. A real user can sign in.
2. A real location can load nearby plans.
3. A user can create a plan.
4. Another user can join it.
5. Both can chat.
6. Both can check in.
7. Analytics records the Successful Meet.
8. A user can mark I'm Free and receive deterministic recommendations.
9. A user can translate content through a cached, logged AI gateway.

Only after these work should the team add:
- AI-assisted intent grouping
- AI-generated plans
- merchant plans
- complex personalized AI matching

The first milestone is not "app complete".

The first milestone is:

> **Two strangers can successfully meet through the product, while AI cost remains measurable and optional.**
