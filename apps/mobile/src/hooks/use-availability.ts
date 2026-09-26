import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import type { NearbyPlan } from '@/types/nearby-plan';
import { mapFormingGroup, type FormingGroup, type FormingGroupRow } from '@/types/forming-group';
import type { AgeSummary, PreferredAge } from '@/types/age-band';

type NearbyPlanRow = {
  id: string; title: string; activity_type: string; starts_at: string; venue_id: string | null;
  latitude: number; longitude: number; distance_m: number; joined_count: number;
  max_participants: number; status: NearbyPlan['status']; score: number;
  preferred_age: PreferredAge; age_summary: AgeSummary | null; viewer_outside_preferred_age: boolean;
};

export type AvailabilityResult = {
  intentId: string;
  expiresAt: string;
  plans: NearbyPlan[];
  compatiblePeople: number;
  sharedInterest: string | null;
  formingGroup: FormingGroup | null;
};

export function useCreateAvailability() {
  const demoMode = useSessionStore((state) => state.demoMode);

  return useMutation({
    mutationFn: async ({ expiresAt, latitude, longitude, maxDistanceM, interests }: { expiresAt: string; latitude: number; longitude: number; maxDistanceM: number; interests: string[] }): Promise<AvailabilityResult> => {
      if (demoMode) {
        const now = Date.now();
        const selectedInterest = interests.find((interest) => interest !== 'anything') ?? 'coffee';
        const isWalk = selectedInterest === 'walk' || selectedInterest === 'sunset' || selectedInterest === 'sport';
        const plan: NearbyPlan = {
          id: isWalk ? 'demo-walk' : 'demo-coffee',
          title: isWalk ? 'Sunset walk in the park' : 'Coffee & good conversation',
          activityType: isWalk ? 'walk' : 'coffee',
          startsAt: new Date(now + (isWalk ? 90 : 45) * 60_000).toISOString(),
          venueId: null,
          latitude: latitude + (isWalk ? -0.008 : 0.009),
          longitude: longitude + (isWalk ? 0.011 : -0.006),
          distanceM: Math.min(maxDistanceM, isWalk ? 1400 : 900),
          joinedCount: isWalk ? 2 : 3,
          maxParticipants: isWalk ? 5 : 6,
          status: 'open',
          score: isWalk ? 0.89 : 0.96,
          preferredAge: isWalk ? '25_34' : 'any',
          ageSummary: isWalk ? null : { type: 'mostly', band: '20s' },
          viewerOutsidePreferredAge: isWalk,
        };

        return {
          intentId: `demo-${now}`,
          expiresAt,
          plans: [plan],
          compatiblePeople: 3,
          sharedInterest: selectedInterest,
          formingGroup: {
            id: `demo-forming-${now}`,
            activityType: selectedInterest,
            memberCount: 3,
            startsAt: new Date(now + 30 * 60_000).toISOString(),
            expiresAt: new Date(now + 10 * 60_000).toISOString(),
            status: 'forming',
            planId: null,
            response: 'invited',
          },
        };
      }

      const created = await supabase.rpc('create_availability_intent', {
        p_expires_at: expiresAt,
        p_latitude: latitude,
        p_longitude: longitude,
        p_max_distance_m: maxDistanceM,
        p_interest_slugs: interests,
      });
      if (created.error) throw created.error;
      const intent = created.data as { id: string; expires_at: string };
      const [recommendations, compatible, formation] = await Promise.all([
        supabase.rpc('recommend_plans_for_intent', { target_intent_id: intent.id }),
        supabase.rpc('find_compatible_intents', { target_intent_id: intent.id }),
        supabase.rpc('create_forming_group', { target_intent_id: intent.id }),
      ]);
      if (recommendations.error) throw recommendations.error;
      if (compatible.error) throw compatible.error;
      if (formation.error) throw formation.error;
      const match = compatible.data as { compatible_people: number; shared_interest: string | null } | null;
      return {
        intentId: intent.id,
        expiresAt: intent.expires_at,
        plans: ((recommendations.data ?? []) as NearbyPlanRow[]).map((row) => ({
          id: row.id,
          title: row.title,
          activityType: row.activity_type,
          startsAt: row.starts_at,
          venueId: row.venue_id,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          distanceM: Number(row.distance_m),
          joinedCount: Number(row.joined_count),
          maxParticipants: row.max_participants,
          status: row.status,
          score: Number(row.score),
          preferredAge: row.preferred_age,
          ageSummary: row.age_summary,
          viewerOutsidePreferredAge: row.viewer_outside_preferred_age,
        })),
        compatiblePeople: Number(match?.compatible_people ?? 0),
        sharedInterest: match?.shared_interest ?? null,
        formingGroup: mapFormingGroup(formation.data as FormingGroupRow | null),
      };
    },
  });
}
