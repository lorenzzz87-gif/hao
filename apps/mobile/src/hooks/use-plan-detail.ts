import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEMO_USER_ID, getDemoPlanDetail } from '@/lib/demo-chat';
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
  const demoMode = useSessionStore((state) => state.demoMode);
  return useMutation({
    mutationFn: async (options?: { acknowledgedAgePreference?: boolean; agePromptInteractionId?: string }) => {
      if (demoMode) return { demo: true };
      const result = action === 'join'
        ? await supabase.rpc('join_plan', {
          target_plan_id: planId,
          p_acknowledged_age_preference: options?.acknowledgedAgePreference ?? false,
          p_age_prompt_interaction_id: options?.agePromptInteractionId ?? null,
        })
        : await supabase.rpc('leave_plan', { target_plan_id: planId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      if (demoMode) {
        queryClient.setQueryData<PlanDetail>(['plan-detail', planId], (current) => current ? {
          ...current,
          is_joined: action === 'join',
          joined_count: Math.max(0, current.joined_count + (action === 'join' ? 1 : -1)),
          seats_remaining: Math.max(0, current.seats_remaining + (action === 'join' ? -1 : 1)),
          members: action === 'join'
            ? current.members.some((member) => member.id === DEMO_USER_ID) ? current.members : [...current.members, { id: DEMO_USER_ID, display_name: 'You', avatar_url: null, role: 'member', common_interests: 3, phone_verified: true, identity_verified: false, successful_meets: 2 }]
            : current.members.filter((member) => member.id !== DEMO_USER_ID),
        } : current);
        return;
      }
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
