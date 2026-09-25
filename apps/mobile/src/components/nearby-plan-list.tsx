import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { PlanCard } from '@/components/plan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useNearbyPlans } from '@/hooks/use-nearby-plans';

export function NearbyPlanList() {
  const router = useRouter();
  const plans = useNearbyPlans();

  if (plans.isLoading) return <ThemedView style={styles.center}><ActivityIndicator /><ThemedText type="small" themeColor="textSecondary">Finding plans nearby…</ThemedText></ThemedView>;
  if (plans.error) return <ThemedView type="backgroundElement" style={styles.state}><ThemedText type="smallBold">Plans couldn&apos;t load</ThemedText><ThemedText type="small" themeColor="textSecondary">{plans.error.message}</ThemedText><Pressable onPress={() => void plans.refetch()}><ThemedText type="linkPrimary">Try again</ThemedText></Pressable></ThemedView>;
  if (!plans.data?.length) return <ThemedView type="backgroundElement" style={styles.state}><ThemedText style={styles.stateTitle}>Be the first plan in this area</ThemedText><ThemedText type="small" themeColor="textSecondary">Nothing is scheduled nearby in the next six hours.</ThemedText><Pressable onPress={() => router.push('/create')} style={styles.stateAction}><ThemedText style={styles.stateActionText}>Create a plan</ThemedText></Pressable></ThemedView>;

  return <ThemedView style={styles.list}>{plans.data.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</ThemedView>;
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three }, center: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  state: { minHeight: 180, padding: Spacing.four, justifyContent: 'center', borderRadius: 24, gap: Spacing.two, borderWidth: 1, borderColor: Brand.border },
  stateTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800' },
  stateAction: { alignSelf: 'flex-start', marginTop: Spacing.two, minHeight: 42, borderRadius: 21, backgroundColor: Brand.primary, justifyContent: 'center', paddingHorizontal: Spacing.three },
  stateActionText: { color: '#FFFFFF', fontWeight: '800' },
});
