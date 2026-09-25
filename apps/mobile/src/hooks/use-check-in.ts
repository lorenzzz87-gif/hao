import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export type PlanCheckInStatus = {
  plan_id: string;
  plan_status: 'open' | 'confirmed' | 'full' | 'started' | 'completed' | 'cancelled';
  self_checked_in: boolean;
  checked_in_count: number;
  successful_meet: boolean;
  distance_m: number | null;
};

export function usePlanCheckInStatus(planId: string, enabled: boolean) {
  const demoMode = useSessionStore((state) => state.demoMode);
  return useQuery({
    queryKey: ['plan-check-in', planId],
    enabled: Boolean(planId) && enabled,
    queryFn: async () => {
      if (demoMode) return { plan_id: planId, plan_status: 'open', self_checked_in: false, checked_in_count: 0, successful_meet: false, distance_m: null } as PlanCheckInStatus;
      const result = await supabase.rpc('get_plan_check_in_status', { target_plan_id: planId });
      if (result.error) throw result.error;
      return result.data as PlanCheckInStatus;
    },
  });
}

export function useCheckIn(planId: string) {
  const queryClient = useQueryClient();
  const demoMode = useSessionStore((state) => state.demoMode);
  return useMutation({
    mutationFn: async () => {
      if (demoMode) return { plan_id: planId, plan_status: 'open', self_checked_in: true, checked_in_count: 1, successful_meet: false, distance_m: null } as PlanCheckInStatus;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) throw new Error('Location permission is required to confirm you are at the meeting place.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const result = await supabase.rpc('check_in', {
        target_plan_id: planId,
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
      });
      if (result.error) throw result.error;
      return result.data as PlanCheckInStatus;
    },
    onSuccess: async (status) => {
      queryClient.setQueryData(['plan-check-in', planId], status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] }),
        queryClient.invalidateQueries({ queryKey: ['meet-stats'] }),
      ]);
    },
  });
}

export function useMeetStats(enabled = true) {
  return useQuery({
    queryKey: ['meet-stats'],
    enabled,
    queryFn: async () => {
      const result = await supabase.rpc('get_my_meet_stats');
      if (result.error) throw result.error;
      return result.data as { successful_meets: number; plans_checked_in: number };
    },
  });
}
