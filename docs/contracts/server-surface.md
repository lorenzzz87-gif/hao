# V1 server surface

Mobile clients use authenticated database RPCs for mutations that need authorization, locking, or cross-row invariants.

## Foundation RPCs

| Function | Responsibility | AI |
| --- | --- | --- |
| `discover_nearby_plans` | Six-hour spatial search and deterministic scoring | Never |
| `join_plan` | Authorization, block check, capacity lock, membership, status | Never |
| `leave_plan` | Membership update and status recalculation | Never |
| `cancel_plan` | Require the creator, lock the plan, mark it cancelled, and notify the group | Never |
| `create_plan` | Validate input, create a public venue and plan, add creator membership | Never |
| `get_plan_detail` | Return safe plan, venue, membership, and capacity details | Never |
| `get_my_plan_chats` | List joined-plan chats with their latest visible message | Never |
| `block_user` | Validate a shared-plan relationship and create immediate mutual isolation | Never |
| `report_target` | Validate user, plan, or message evidence and enqueue human moderation | Never |
| `create_availability_intent` | Replace a user’s prior active intent with private, expiring availability | Never |
| `recommend_plans_for_intent` | Rank real plans by time, distance, and interest overlap | Never |
| `find_compatible_intents` | Count real nearby users with overlapping time and interests without exposing locations | Never |
| `check_in` | Validate membership, time window, and distance before recording attendance | Never |
| `get_plan_check_in_status` | Refresh plan lifecycle and return member-safe attendance status | Never |
| `get_my_meet_stats` | Return the signed-in user’s check-in and Successful Meet totals | Never |
| `translate-content` Edge Function | Authorize source access, reuse cached translations, enforce budgets, call OpenAI, and log usage | On cache miss only |

Plan chat messages use table RLS: only current members can read or send, clients can only create `text` and `quick_action` messages, and join/leave/confirmation system messages are produced by server RPCs.

## Next slices

- `generate_plan_title` (optional)

All AI calls stay server-side behind feature flags, limits, cost logging, timeouts, and a kill switch. Core meet functionality cannot depend on AI availability.
