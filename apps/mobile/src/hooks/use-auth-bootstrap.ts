import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useSessionStore } from '@/stores/session-store';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5_000;
const DEMO_MODE_KEY = 'now-demo-mode';

async function settleWithin<T>(work: PromiseLike<T>, fallback: T) {
  try {
    return await withTimeout(work, AUTH_BOOTSTRAP_TIMEOUT_MS, 'auth_bootstrap_timeout');
  } catch {
    return fallback;
  }
}

export function useAuthBootstrap() {
  const setDemoMode = useSessionStore((state) => state.setDemoMode);
  const setSession = useSessionStore((state) => state.setSession);
  const markInitialized = useSessionStore((state) => state.markInitialized);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.all([
      settleWithin(supabase.auth.getSession(), null),
      settleWithin(AsyncStorage.getItem(DEMO_MODE_KEY), null),
    ]).then(([sessionResult, storedDemoMode]) => {
      if (!mounted) return;

      const initialSession = sessionResult?.data.session ?? null;
      setSession(initialSession);
      setDemoMode(!initialSession && storedDemoMode === 'enabled');
      markInitialized();

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setSession(session);
        if (session) {
          setDemoMode(false);
          void AsyncStorage.removeItem(DEMO_MODE_KEY);
        }
        markInitialized();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [markInitialized, setDemoMode, setSession]);
}
