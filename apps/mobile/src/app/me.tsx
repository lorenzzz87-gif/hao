import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeetStats } from '@/hooks/use-check-in';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { userFacingError } from '@/lib/user-facing-error';

export default function MeScreen() {
  const demoMode = useSessionStore((state) => state.demoMode);
  const setDemoMode = useSessionStore((state) => state.setDemoMode);
  const stats = useMeetStats(!demoMode);
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
    Alert.alert('Delete account?', 'This permanently deletes your HAO account, profile, messages, memberships, and activity. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete permanently', style: 'destructive', onPress: () => void deleteAccount() },
    ]);
  }
  async function deleteAccount() {
    setDeleting(true); setDeleteError(null);
    const result = await supabase.rpc('delete_my_account');
    if (result.error) { setDeleteError(userFacingError(result.error, 'Your account could not be deleted. Please try again.')); setDeleting(false); return; }
    await supabase.auth.signOut();
    setDeleting(false);
  }
  return (
    <ThemedView style={styles.screen}><SafeAreaView style={styles.content}>
      <View style={styles.heading}><ThemedText type="subtitle">Me</ThemedText>{demoMode ? <ThemedText type="small" themeColor="textSecondary">Testing channel · browse-only</ThemedText> : phone && <ThemedText type="small" themeColor="textSecondary">{phone}</ThemedText>}</View>
      <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">Your real-world activity</ThemedText>{demoMode ? <ThemedText type="small" themeColor="textSecondary">Activity is not recorded in test mode.</ThemedText> : stats.isLoading ? <ActivityIndicator /> : stats.error ? <><ThemedText type="small" style={styles.error}>{stats.error.message}</ThemedText><Pressable onPress={() => void stats.refetch()}><ThemedText type="linkPrimary">Try again</ThemedText></Pressable></> : <View style={styles.stats}><View style={styles.stat}><ThemedText type="subtitle">{stats.data?.successful_meets ?? 0}</ThemedText><ThemedText type="small" themeColor="textSecondary">Successful Meets</ThemedText></View><View style={styles.stat}><ThemedText type="subtitle">{stats.data?.plans_checked_in ?? 0}</ThemedText><ThemedText type="small" themeColor="textSecondary">Plans checked in</ThemedText></View></View>}</ThemedView>
      <ThemedText type="small" themeColor="textSecondary">A Successful Meet requires at least two valid check-ins and a completed plan.</ThemedText>
      {!demoMode && <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">Account and privacy</ThemedText><ThemedText type="small" themeColor="textSecondary">Deleting your account permanently removes your profile and associated personal data.</ThemedText>{deleteError && <ThemedText type="small" style={styles.error}>{deleteError}</ThemedText>}<Pressable accessibilityRole="button" disabled={deleting} onPress={confirmDelete} style={styles.deleteButton}><ThemedText style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete account'}</ThemedText></Pressable></ThemedView>}
      <Pressable onPress={() => void leave()} style={styles.signOut}><ThemedText>{demoMode ? 'Exit test mode' : 'Sign out'}</ThemedText></Pressable>
    </SafeAreaView></ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, content: { width: '100%', maxWidth: MaxContentWidth, flex: 1, padding: Spacing.four, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.four }, heading: { gap: Spacing.one }, card: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three }, stats: { flexDirection: 'row', gap: Spacing.four }, stat: { flex: 1, gap: Spacing.one }, error: { color: '#B42318' }, deleteButton: { minHeight: 46, borderWidth: 1, borderColor: '#B42318', borderRadius: 23, alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#B42318', fontWeight: '700' }, signOut: { marginTop: 'auto', minHeight: 48, borderWidth: 1, borderColor: '#C9CBD1', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
