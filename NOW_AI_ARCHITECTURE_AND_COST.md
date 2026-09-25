# NOW — AI Architecture & Cost Governance

## Core rule

> AI understands and judges. PostgreSQL/PostGIS and application code calculate and execute.

The app must remain functional when all optional AI features are disabled.

## V1 AI features

### 1. Translation — ON
Primary recurring AI workload.

Pipeline:
1. user requests translation
2. read source content
3. hash source text
4. query translation cache
5. cache hit -> return without model call
6. cache miss -> call low-cost model
7. save translation
8. write ai_usage_logs record

Never send full chat history to translate one message.

### 2. Plan title generation — OPTIONAL
Only used when a creator provides activity/time/location but no useful title.
Can be disabled at any time without affecting the product.

### 3. Intent grouping AI — OFF in V1
Candidate users/groups are generated deterministically first.
AI can later choose among already-valid candidate groupings.

## Not AI

- nearby search
- distance
- time overlap
- interest overlap
- map refresh
- capacity
- join/leave
- check-in
- plan state machine
- notifications
- availability expiration
- first-pass clustering

## Gateway requirements

All AI calls are server-side.

Gateway must implement:
- feature flag
- model alias, not hard-coded model names in clients
- daily/monthly budget check
- per-user call rate limit
- timeout
- limited retry
- token capture
- estimated cost calculation
- error logging
- cache awareness
- kill switch

## Cost dimensions

Every billable request should be attributable, when possible, to:
- feature
- user
- plan
- provider
- model
- date/time

Admin dashboard should expose:
- cost today
- cost this month
- cost by feature
- cost by model
- cost per MAU
- cost per plan
- cost per Successful Meet
- translation cache-hit rate

## Cost guardrails

Suggested initial product rules:
- translation: on-demand only
- no proactive translate-all
- no model call on I'm Free
- no model call on map refresh
- no model call to calculate distance/time compatibility
- no strong model unless candidate set already exists
- optional AI silently degrades when budget is hit
- core meet flow never depends on AI availability

## Future AI Liquidity Engine

Future architecture:

1. deterministic candidate generation
   - spatial threshold
   - time overlap
   - activity overlap
   - block/safety filters

2. candidate scoring
   - deterministic baseline

3. optional strong-model decision
   - only if multiple candidates remain ambiguous
   - choose group/time/venue suggestion

4. create a forming plan only after users opt in

This keeps AI cost proportional to meaningful group-formation opportunities, not to raw app traffic.
