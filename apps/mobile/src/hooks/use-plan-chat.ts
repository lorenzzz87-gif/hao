import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { DEMO_USER_ID, getDemoChats, getDemoMessages } from '@/lib/demo-chat';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import type { PlanChatSummary, PlanMessage } from '@/types/plan-message';

export function useMyPlanChats() {
  const demoMode = useSessionStore((state) => state.demoMode);
  return useQuery({
    queryKey: ['my-plan-chats', demoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (demoMode) return getDemoChats();
      const result = await supabase.rpc('get_my_plan_chats');
      if (result.error) throw result.error;
      return (result.data ?? []) as PlanChatSummary[];
    },
  });
}

export function usePlanMessages(planId: string) {
  const queryClient = useQueryClient();
  const demoMode = useSessionStore((state) => state.demoMode);
  const modeKey = demoMode ? 'demo' : 'live';
  const query = useQuery({
    queryKey: ['plan-messages', modeKey, planId],
    enabled: Boolean(planId),
    queryFn: async () => {
      if (demoMode) return getDemoMessages(planId);
      const result = await supabase.from('plan_messages').select('id,plan_id,sender_id,message_type,body,created_at').eq('plan_id', planId).is('deleted_at', null).order('created_at');
      if (result.error) throw result.error;
      return result.data as PlanMessage[];
    },
  });

  useEffect(() => {
    if (!planId || demoMode) return;
    const channel = supabase.channel(`plan-chat:${planId}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'plan_messages', filter: `plan_id=eq.${planId}` },
      (payload) => {
        const incoming = payload.new as PlanMessage;
        queryClient.setQueryData<PlanMessage[]>(['plan-messages', modeKey, planId], (current = []) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
        void queryClient.invalidateQueries({ queryKey: ['my-plan-chats'] });
      },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [demoMode, modeKey, planId, queryClient]);

  return query;
}

export function useSendPlanMessage(planId: string) {
  const sessionUserId = useSessionStore((state) => state.session?.user.id);
  const demoMode = useSessionStore((state) => state.demoMode);
  const userId = demoMode ? DEMO_USER_ID : sessionUserId;
  const modeKey = demoMode ? 'demo' : 'live';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, type }: { body: string; type: 'text' | 'quick_action' }) => {
      if (!userId) throw new Error('You must be signed in.');
      if (demoMode) {
        return {
          id: `demo-message-${Date.now()}`,
          plan_id: planId,
          sender_id: DEMO_USER_ID,
          message_type: type,
          body: body.trim(),
          created_at: new Date().toISOString(),
        } satisfies PlanMessage;
      }
      const result = await supabase.from('plan_messages').insert({ plan_id: planId, sender_id: userId, message_type: type, body: body.trim() }).select('id,plan_id,sender_id,message_type,body,created_at').single();
      if (result.error) throw result.error;
      return result.data as PlanMessage;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<PlanMessage[]>(['plan-messages', modeKey, planId], (current = []) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      void queryClient.invalidateQueries({ queryKey: ['my-plan-chats'] });
    },
  });
}
