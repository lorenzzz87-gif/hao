import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getDemoPlanDetail } from '@/lib/demo-chat';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import type { PlanDetail } from '@/types/plan-detail';

export function usePlanDetail(planId: string) {
  const demoMode = useSessionStore((state) => state.demoMode);
  return useQuery({
    queryKey: ['plan-detail', planId],
    enabled: Boolean(planId),
    queryFn: async () => {
      if (demoMode && planId.startsWith('demo-')) return getDemoPlanDetail(planId);
      const result = await supabase.rpc('get_plan_detail', { target_plan_id: planId });
      if (result.error) throw result.error;
      return result.data as PlanDetail;
    },
  });
}

export function usePlanMembership(planId: string, action: 'join' | 'leave') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc(action === 'join' ? 'join_plan' : 'leave_plan', { target_plan_id: planId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] }),
        queryClient.invalidateQueries({ queryKey: ['nearby-plans'] }),
        queryClient.invalidateQueries({ queryKey: ['my-plan-chats'] }),
      ]);
    },
  });
}

export function useCancelPlan(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc('cancel_plan', { target_plan_id: planId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] }),
        queryClient.invalidateQueries({ queryKey: ['nearby-plans'] }),
        queryClient.invalidateQueries({ queryKey: ['my-plan-chats'] }),
      ]);
    },
  });
}
