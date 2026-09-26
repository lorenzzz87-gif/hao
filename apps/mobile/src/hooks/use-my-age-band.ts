import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import type { AgeBand } from '@/types/age-band';

export function useMyAgeBand() {
  const demoMode = useSessionStore((state) => state.demoMode);
  return useQuery({
    queryKey: ['my-age-band', demoMode ? 'demo' : 'live'],
    queryFn: async (): Promise<AgeBand> => {
      if (demoMode) return '20s';
      const result = await supabase.rpc('get_my_age_band');
      if (result.error) throw result.error;
      return result.data as AgeBand;
    },
  });
}
