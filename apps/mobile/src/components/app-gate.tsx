import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import AppTabs from '@/components/app-tabs';
import { AuthScreen } from '@/components/auth-screen';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import i18n from '@/lib/i18n';
import { userFacingError } from '@/lib/user-facing-error';

export function AppGate() {
  const { t } = useTranslation();
  useAuthBootstrap();
  const queryClient = useQueryClient();
  const initialized = useSessionStore((state) => state.initialized);
  const demoMode = useSessionStore((state) => state.demoMode);
  const session = useSessionStore((state) => state.session);
  const profile = useQuery({
    queryKey: ['my-profile', session?.user.id],
    enabled: Boolean(session) && !demoMode,
    queryFn: async () => {
      const result = await supabase.from('profiles').select('onboarding_completed,primary_language').eq('id', session!.user.id).single();
      if (result.error) throw result.error;
      if (result.data.primary_language) await i18n.changeLanguage(result.data.primary_language);
      return result.data;
    },
  });

  if (!initialized || (session && !demoMode && profile.isLoading)) return <ThemedView style={styles.loading}><ActivityIndicator /></ThemedView>;
  if (demoMode) return <AppTabs />;
  if (!session) return <AuthScreen />;
  if (profile.error) {
    return (
      <ThemedView style={styles.errorState}>
        <ThemedText type="subtitle">{t('gate.profileTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary">{userFacingError(profile.error, t('gate.profileError'))}</ThemedText>
        <Pressable onPress={() => void profile.refetch()} style={styles.action}><ThemedText style={styles.actionText}>{t('tryAgain')}</ThemedText></Pressable>
        <Pressable onPress={() => void supabase.auth.signOut()}><ThemedText type="small">{t('profile.signOut')}</ThemedText></Pressable>
      </ThemedView>
    );
  }
  if (!profile.data?.onboarding_completed) return <OnboardingScreen onCompleted={() => void queryClient.invalidateQueries({ queryKey: ['my-profile'] })} />;
  return <AppTabs />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorState: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  action: { minHeight: 50, borderRadius: 25, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFFFFF', fontWeight: '700' },
});
