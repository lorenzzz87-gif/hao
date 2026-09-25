# Plan lifecycle contract

The database is the source of truth for plan state. Clients display state and request actions; they never calculate authoritative transitions.

## States

- `draft`: creator-only, not discoverable.
- `open`: discoverable and joinable, below the minimum participant count.
- `confirmed`: minimum reached and seats remain.
- `full`: maximum reached.
- `started`: start time reached.
- `completed`: end window passed.
- `cancelled`: creator/system cancellation or confirmation deadline missed.

## Allowed transitions

```text
draft -> open | cancelled
open -> confirmed | full | cancelled
confirmed -> open | full | started | cancelled
full -> confirmed | started | cancelled
started -> completed | cancelled
```

Capacity-changing transitions occur inside `join_plan` and `leave_plan` while the plan row is locked. Time-based transitions are performed by a scheduled server job. Terminal states do not reopen.

## Successful Meet

A plan qualifies only when it is `completed` and at least two distinct joined members checked in during the accepted time/location window. Counting must be idempotent.

