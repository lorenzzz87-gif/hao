import type { PlanDetail } from '@/types/plan-detail';
import type { PlanChatSummary, PlanMessage } from '@/types/plan-message';

export const DEMO_USER_ID = 'demo-me';

function planStartsAt(planId: string) {
  const offsetMinutes = planId === 'demo-walk' ? 90 : 45;
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

export function getDemoChats(): PlanChatSummary[] {
  return [
    {
      plan_id: 'demo-coffee',
      title: 'Coffee & good conversation',
      starts_at: planStartsAt('demo-coffee'),
      status: 'open',
      last_message: "I'm on my way",
      last_message_at: new Date(Date.now() - 4 * 60_000).toISOString(),
    },
    {
      plan_id: 'demo-walk',
      title: 'Sunset walk in the park',
      starts_at: planStartsAt('demo-walk'),
      status: 'open',
      last_message: "I'm on my way",
      last_message_at: new Date(Date.now() - 18 * 60_000).toISOString(),
    },
  ];
}

export function getDemoMessages(planId: string): PlanMessage[] {
  const now = Date.now();
  return [
    { id: `${planId}-system`, plan_id: planId, sender_id: null, message_type: 'system', body: 'This is a private group chat for plan members.', created_at: new Date(now - 24 * 60_000).toISOString() },
    { id: `${planId}-host`, plan_id: planId, sender_id: 'demo-host', message_type: 'text', body: planId === 'demo-walk' ? 'Meet by the park entrance?' : 'I found a table near the main entrance.', created_at: new Date(now - 12 * 60_000).toISOString() },
    { id: `${planId}-member`, plan_id: planId, sender_id: 'demo-member', message_type: 'quick_action', body: "I'm on my way", created_at: new Date(now - 7 * 60_000).toISOString() },
  ];
}

export function getDemoPlanDetail(planId: string): PlanDetail {
  const isWalk = planId === 'demo-walk';
  return {
    id: planId,
    creator_id: 'demo-host',
    title: isWalk ? 'Sunset walk in the park' : 'Coffee & good conversation',
    note: isWalk ? 'A relaxed walk before sunset.' : 'A casual coffee with friendly people nearby.',
    activity_type: isWalk ? 'walk' : 'coffee',
    starts_at: planStartsAt(planId),
    expected_end_at: new Date(Date.now() + (isWalk ? 180 : 120) * 60_000).toISOString(),
    status: 'open',
    min_participants: 2,
    max_participants: isWalk ? 5 : 6,
    joined_count: isWalk ? 2 : 3,
    seats_remaining: isWalk ? 3 : 3,
    is_joined: !isWalk,
    is_creator: false,
    preferred_age: isWalk ? '25_34' : 'any',
    age_summary: isWalk ? null : { type: 'mostly', band: '20s' },
    viewer_outside_preferred_age: isWalk,
    venue: { id: null, name: isWalk ? 'Park main entrance' : 'Central café', address: null, latitude: 0, longitude: 0, is_public_place: true, is_approximate: true },
    members: [
      { id: 'demo-host', display_name: 'Alex', avatar_url: null, role: 'creator', common_interests: 2, phone_verified: true, identity_verified: true, successful_meets: 7 },
      ...(!isWalk ? [{ id: DEMO_USER_ID, display_name: 'You', avatar_url: null, role: 'member' as const, common_interests: 3, phone_verified: true, identity_verified: false, successful_meets: 2 }] : []),
      ...(!isWalk ? [{ id: 'demo-member', display_name: 'Mia', avatar_url: null, role: 'member' as const, common_interests: 1, phone_verified: true, identity_verified: false, successful_meets: 4 }] : []),
    ],
  };
}
