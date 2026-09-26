# LLM Wiki Log

## [2026-09-26] decision | privacy-preserving age compatibility

- Confirmed the first age-band release will not filter or reorder plans.
- Suppress all group age summaries below three joined members to prevent individual inference.
- Use non-overlapping host preference ranges and allow out-of-range members to join after a neutral confirmation.
- Exact birth dates remain server-only; clients receive only an age-band label or aggregate summary.

## [2026-09-26] decision | location-optional discovery

- Added a persistent manual launch-city choice for browsing without location permission.
- Manual city centers are explicitly treated as approximate browsing areas, never as user locations.
- “I'm Free” continues to require a fresh device area so proximity matching cannot use a fake city-center position.
- Plan creation from a manual city uses a broad public meetup area until verified venue search is connected.

## 2026-09-07 — Web test authentication

- Added email passwordless login as the default web-test path while preserving phone OTP and the social-auth placeholders.
- Email sign-in supports both the hosted magic link template and a six-digit OTP template once configured in Supabase.

## 2026-09-06 — Social sign-in foundation

- Added Apple and Google OAuth entry points with Expo AuthSession, Supabase session exchange, deep-link return handling, cancellation, and inline errors.
- Social providers remain visibly marked as setup-required and disabled by feature flags until their Apple/Google developer credentials are configured; phone OTP remains available.

## 2026-09-12 — Closed-test entry channel

- Added an environment-gated, one-click testing channel that bypasses sign-in without creating or impersonating a Supabase user.
- Test mode persists across refreshes, is labeled browse-only, skips authenticated profile/stat requests, and provides a clear exit action.
- Production safety boundary: `EXPO_PUBLIC_DEMO_MODE_ENABLED` defaults to false in the example configuration and must be explicitly enabled for a test build.

## 2026-09-06 — Hosted Supabase foundation

- Created a dedicated free `NOW` Supabase project in `eu-west-1` and deployed all V1 database migrations.
- Seed defaults keep AI translation and title generation disabled while no OpenAI API key is configured; the deterministic meet loop remains available.

## 2026-09-06 — Creator cancellation slice

- Added an idempotent creator-only plan cancellation RPC with row locking and explicit completed-plan protection.
- Cancelled plans leave discovery immediately while existing members retain the group chat and receive a system notice.
- Added a destructive confirmation to the plan detail screen and prevented stale cancelled, started, or completed plans from showing an active Join action.

## 2026-09-06 — On-demand translation slice

- Added explicit Translate actions for plan titles, plan notes, and individual chat messages; no content is translated proactively.
- The server reads only the requested source item, hashes it, and reuses translations by content, target language, and source hash.
- Cache misses use the OpenAI Responses API through a server-only Edge Function with a 12-second timeout and one limited retry.
- Translation observes feature flags, daily/monthly budgets, per-user call caps, and records token usage, estimated cost, latency, cache hits, and errors.
- Translation failure leaves original content and every core meet flow available.

## 2026-09-06 — Check-in and Successful Meet slice

- Added an idempotent I’m here check-in for joined members using a fresh foreground location reading.
- Server validation accepts check-in from 30 minutes before start through 30 minutes after expected end and within 300 metres of the meeting place.
- Plan lifecycle refreshes to started/completed and records a Successful Meet exactly once after completion when at least two valid members checked in.
- Added personal Successful Meet and checked-in plan totals to Me.

## 2026-09-06 — I’m Free availability slice

- Added the primary I’m Free action with 30-minute, 1-hour, 2-hour, and Tonight windows, multi-interest selection, and distance choice.
- Availability replaces the user’s prior active intent, expires automatically, and keeps raw coordinates private.
- Recommendations use deterministic time, distance, and interest scoring; creating an intent never calls AI.
- Empty states only mention nearby compatible people when the database finds enough real overlapping intents.

## 2026-09-06 — User safety slice

- Added plan, participant, and chat-message reporting with fixed reason codes and optional reviewer context.
- Added a confirmed destructive block action for people who share a joined plan.
- Reports enter a private human moderation queue; submitting a report does not automatically ban anyone.
- Direct table inserts were removed for blocks and reports so clients cannot bypass server validation or rate limits.
- A blocked relationship disappears from discovery, plan detail, and the shared chat inbox for both people.

## 2026-09-06 — Realtime plan chat slice

- Added a joined-plan chat inbox and member-only chat rooms.
- Added live message delivery through Supabase Realtime plus four deterministic coordination replies.
- Join, leave, and plan-confirmed notices are generated by server functions; clients cannot forge system messages.
- Chat summaries and membership changes share cache invalidation so the Chats tab stays current.

## 2026-09-06 — Plan detail and membership slice

- Added plan detail navigation from list cards and native map callouts.
- Added a privacy-filtered detail RPC with venue, capacity, and limited member profiles.
- Made join idempotent, blocked joining when any current participant has a mutual block, and prevented creators from accidentally leaving their own plan.
- Join and leave invalidate both plan detail and nearby discovery caches.

## 2026-09-06 — Create plan slice

- Added deterministic plan creation with server-side validation and no AI dependency.
- Venue, plan, interest, and creator membership are written atomically.
- V1 accepts a public venue name/address and temporarily pins it to the user's current position until venue search is connected.
- Plans must start within 10 minutes to 6 hours and groups are limited to 2–12 people.

## 2026-09-06 — Nearby discovery slice

- Added foreground-only location permission with an explicit privacy explanation and settings recovery.
- Added a shared 5 km / six-hour PostGIS query for Now and Map; no AI call is involved.
- Extended nearby-plan results with coordinates so native map pins use product-owned PostGIS data.
- Added truthful loading, error, permission-denied, and empty states.

## 2026-09-06 — Authentication and onboarding slice

- Added phone OTP authentication as the first closed-test path; Apple and Google remain pending production credentials.
- Added server-enforced 18+ validation, supported languages, and exactly 3–5 valid interests.
- Verified TypeScript, ESLint, and Expo Web static export.

## 2026-09-06 — Foundation initialization

- Created the project wiki.
- Recorded the vertical-slice delivery order, AI boundary, stack, security baseline, and first server contracts.
- Source material: the two NOW specifications, starter schema, and user confirmation to begin foundation development before using parallel agents.
