import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/stores/location-store';
import { useSessionStore } from '@/stores/session-store';
import type { NearbyPlan } from '@/types/nearby-plan';
import type { AgeSummary, PreferredAge } from '@/types/age-band';

type NearbyPlanRow = {
  id: string; title: string; activity_type: string; starts_at: string; venue_id: string | null;
  latitude: number; longitude: number; distance_m: number; joined_count: number;
  max_participants: number; status: NearbyPlan['status']; score: number;
  preferred_age: PreferredAge; age_summary: AgeSummary | null; viewer_outside_preferred_age: boolean;
};

export function useNearbyPlans() {
  const coordinates = useLocationStore((state) => state.coordinates);
  const demoMode = useSessionStore((state) => state.demoMode);

  return useQuery({
    queryKey: ['nearby-plans', demoMode ? 'demo' : 'live', coordinates?.latitude, coordinates?.longitude],
    enabled: Boolean(coordinates),
    refetchInterval: 60_000,
    queryFn: async (): Promise<NearbyPlan[]> => {
      const from = new Date();
      if (demoMode) {
        const startsAt = (offsetMinutes: number) => new Date(from.getTime() + offsetMinutes * 60_000).toISOString();
        return [
          {
            id: 'demo-coffee', title: 'Coffee & good conversation', activityType: 'coffee', startsAt: startsAt(45), venueId: null,
            latitude: coordinates!.latitude + 0.009, longitude: coordinates!.longitude - 0.006, distanceM: 900,
            joinedCount: 3, maxParticipants: 6, status: 'open', score: 0.96,
            preferredAge: 'any', ageSummary: { type: 'mostly', band: '20s' }, viewerOutsidePreferredAge: false,
          },
          {
            id: 'demo-walk', title: 'Sunset walk in the park', activityType: 'walk', startsAt: startsAt(130), venueId: null,
            latitude: coordinates!.latitude - 0.008, longitude: coordinates!.longitude + 0.011, distanceM: 1400,
            joinedCount: 2, maxParticipants: 5, status: 'open', score: 0.89,
            preferredAge: '25_34', ageSummary: null, viewerOutsidePreferredAge: true,
          },
        ];
      }
      const to = new Date(from.getTime() + 6 * 60 * 60 * 1000);
      const result = await supabase.rpc('discover_nearby_plans', {
        lat: coordinates!.latitude,
        lng: coordinates!.longitude,
        radius_m: 5_000,
        from_ts: from.toISOString(),
        to_ts: to.toISOString(),
      });
      if (result.error) throw result.error;
      return ((result.data ?? []) as NearbyPlanRow[]).map((row) => ({
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
      }));
    },
  });
}
