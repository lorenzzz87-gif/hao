import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeetStats } from '@/hooks/use-check-in';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { userFacingError } from '@/lib/user-facing-error';
import { useMyAgeBand } from '@/hooks/use-my-age-band';

export default function MeScreen() {
  const { t } = useTranslation();
  const demoMode = useSessionStore((state) => state.demoMode);
  const setDemoMode = useSessionStore((state) => state.setDemoMode);
  const stats = useMeetStats(!demoMode);
  const ageBand = useMyAgeBand();
  const phone = useSessionStore((state) => state.session?.user.phone);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  async function leave() {
    if (demoMode) {
      await AsyncStorage.removeItem('now-demo-mode');
      setDemoMode(false);
      return;
    }
    await supabase.auth.signOut();
  }
  function confirmDelete() {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.deleteConfirm'), style: 'destructive', onPress: () => void deleteAccount() },
    ]);
  }
  async function deleteAccount() {
    setDeleting(true); setDeleteError(null);
    const result = await supabase.rpc('delete_my_account');
    if (result.error) { setDeleteError(userFacingError(result.error, t('profile.deleteError'))); setDeleting(false); return; }
    await supabase.auth.signOut();
    setDeleting(false);
  }
  return (
    <ThemedView style={styles.screen}><SafeAreaView style={styles.content}>
      <View style={styles.heading}><ThemedText type="subtitle">{t('profile.title')}</ThemedText>{demoMode ? <ThemedText type="small" themeColor="textSecondary">{t('profile.demoMode')}</ThemedText> : phone && <ThemedText type="small" themeColor="textSecondary">{phone}</ThemedText>}</View>
      <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{t('profile.activityTitle')}</ThemedText>{demoMode ? <ThemedText type="small" themeColor="textSecondary">{t('profile.activityNotRecorded')}</ThemedText> : stats.isLoading ? <ActivityIndicator /> : stats.error ? <><ThemedText type="small" style={styles.error}>{userFacingError(stats.error, t('profile.statsLoadError'))}</ThemedText><Pressable onPress={() => void stats.refetch()}><ThemedText type="linkPrimary">{t('tryAgain')}</ThemedText></Pressable></> : <View style={styles.stats}><View style={styles.stat}><ThemedText type="subtitle">{stats.data?.successful_meets ?? 0}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('profile.successfulMeets')}</ThemedText></View><View style={styles.stat}><ThemedText type="subtitle">{stats.data?.plans_checked_in ?? 0}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('profile.plansCheckedIn')}</ThemedText></View></View>}</ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{t('profile.ageBand')}</ThemedText>{ageBand.isLoading ? <ActivityIndicator /> : ageBand.error ? <ThemedText type="small" style={styles.error}>{t('profile.ageBandError')}</ThemedText> : <><ThemedText type="subtitle">{t(`age.band.${ageBand.data}`)}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('profile.ageBandHint')}</ThemedText></>}</ThemedView>
      <ThemedText type="small" themeColor="textSecondary">{t('profile.meetExplanation')}</ThemedText>
      {!demoMode && <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{t('profile.accountPrivacy')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('profile.deleteDescription')}</ThemedText>{deleteError && <ThemedText type="small" style={styles.error}>{deleteError}</ThemedText>}<Pressable accessibilityRole="button" disabled={deleting} onPress={confirmDelete} style={styles.deleteButton}><ThemedText style={styles.deleteText}>{deleting ? t('profile.deleting') : t('profile.deleteAccount')}</ThemedText></Pressable></ThemedView>}
      <Pressable onPress={() => void leave()} style={styles.signOut}><ThemedText>{demoMode ? t('profile.exitTest') : t('profile.signOut')}</ThemedText></Pressable>
    </SafeAreaView></ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, flex: 1, padding: Spacing.four, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.four }, heading: { gap: Spacing.one }, card: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three }, stats: { flexDirection: 'row', gap: Spacing.four }, stat: { flex: 1, gap: Spacing.one }, error: { color: '#B42318' }, deleteButton: { minHeight: 46, borderWidth: 1, borderColor: '#B42318', borderRadius: 23, alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#B42318', fontWeight: '700' }, signOut: { marginTop: 'auto', minHeight: 48, borderWidth: 1, borderColor: '#C9CBD1', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
