import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export function useAuthBootstrap() {
  const setDemoMode = useSessionStore((state) => state.setDemoMode);
  const setSession = useSessionStore((state) => state.setSession);
  const markInitialized = useSessionStore((state) => state.markInitialized);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      supabase.auth.getSession(),
      AsyncStorage.getItem('now-demo-mode'),
    ]).then(([{ data }, storedDemoMode]) => {
      if (mounted) {
        setSession(data.session);
        setDemoMode(!data.session && storedDemoMode === 'enabled');
        markInitialized();
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setDemoMode(false);
        void AsyncStorage.removeItem('now-demo-mode');
      }
      markInitialized();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [markInitialized, setDemoMode, setSession]);
}
