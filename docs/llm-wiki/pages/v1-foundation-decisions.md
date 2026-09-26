---
type: decision
status: active
created: 2026-09-06
updated: 2026-09-26
sources:
  - ../../../NOW_V1_DEVELOPMENT_SPEC.md
  - ../../../NOW_AI_ARCHITECTURE_AND_COST.md
  - ../../../NOW_V1_STARTER_SCHEMA.sql
confidence: high
tags: [v1, architecture, supabase, ai-cost]
---

# V1 foundation decisions

## Summary

NOW is built as vertical slices toward a real Successful Meet. Expo SDK 55 owns the mobile experience and Supabase owns authenticated data, PostGIS discovery, Realtime, storage, and server-side invariants.

## Locked decisions

- Home is Now and its primary action is “I'm Free”.
- Nearby discovery, capacity, status, check-in, and intent matching are deterministic.
- V1 check-in is accepted from 30 minutes before the plan until 30 minutes after its expected end, within 300 metres of the meeting point.
- AI is optional, server-side, cached, budgeted, observable, and never required for the core meet loop.
- V1 translation is user-triggered, sends only one requested content item, and targets the user’s primary language.
- Plan and membership mutations with cross-row invariants use database RPCs.
- Every exposed table has RLS; private location and AI cost data are owner/admin only.
- Start single-threaded. Parallelize mobile, backend, and platform work only after contracts and migrations stabilize.
- Phone OTP is the first closed-test authentication path. Apple and Google can be added after production credentials and redirect URLs are available.
- Users can browse and create broad public-area plans after manually choosing a launch city. Manual city coordinates never represent the user and cannot be used for “I'm Free” matching or check-in; those actions require fresh foreground location.
- Age compatibility V1 is display-only: exact birth dates stay server-side, group summaries appear only from three joined members, host preferences are soft and non-overlapping, and out-of-range users can join after a neutral confirmation. Age does not filter or reorder discovery until post-launch evidence supports an experiment.

## Delivery order

Sign in → nearby plans → create → join → chat → check in → Successful Meet → I'm Free → cached translation.

## Open questions

- First launch district and default map center.
