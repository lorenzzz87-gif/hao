import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ReportTarget = 'user' | 'plan' | 'message';
export type ReportReason = 'harassment' | 'hate_or_abuse' | 'unsafe_meetup' | 'spam_or_scam' | 'other';

export function useReportTarget() {
  return useMutation({
    mutationFn: async ({ targetType, targetId, reason, details }: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string }) => {
      const result = await supabase.rpc('report_target', { target_kind: targetType, target_id: targetId, report_reason: reason, report_details: details?.trim() || null });
      if (result.error) throw result.error;
      return result.data;
    },
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await supabase.rpc('block_user', { target_user_id: userId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['nearby-plans'] }),
        queryClient.invalidateQueries({ queryKey: ['plan-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['plan-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['my-plan-chats'] }),
      ]);
    },
  });
}
