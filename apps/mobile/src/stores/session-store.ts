import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type SessionState = {
  demoMode: boolean;
  initialized: boolean;
  session: Session | null;
  setDemoMode: (enabled: boolean) => void;
  setSession: (session: Session | null) => void;
  markInitialized: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  demoMode: false,
  initialized: false,
  session: null,
  setDemoMode: (demoMode) => set({ demoMode }),
  setSession: (session) => set({ session }),
  markInitialized: () => set({ initialized: true }),
}));
