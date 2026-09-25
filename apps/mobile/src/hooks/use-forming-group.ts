import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { mapFormingGroup, type FormingGroup, type FormingGroupRow } from '@/types/forming-group';

export function useMyFormingGroup() {
  const demoMode = useSessionStore((state) => state.demoMode);
  return useQuery({
    queryKey: ['forming-group'],
    enabled: !demoMode,
    refetchInterval: 15_000,
    queryFn: async (): Promise<FormingGroup | null> => {
      const result = await supabase.rpc('get_my_forming_group');
      if (result.error) throw result.error;
      return mapFormingGroup(result.data as FormingGroupRow | null);
    },
  });
}

export function useRespondToFormingGroup() {
  const demoMode = useSessionStore((state) => state.demoMode);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, accept }: { groupId: string; accept: boolean }) => {
      if (demoMode) return accept ? 'demo-coffee' : null;
      const result = await supabase.rpc('respond_to_forming_group', { p_group_id: groupId, p_accept: accept });
      if (result.error) throw result.error;
      return result.data as string | null;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['forming-group'] }),
        queryClient.invalidateQueries({ queryKey: ['nearby-plans'] }),
        queryClient.invalidateQueries({ queryKey: ['plan-chats'] }),
      ]);
    },
  });
}
