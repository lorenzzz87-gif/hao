import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import type { NearbyPlan } from '@/types/nearby-plan';
import { formatPlanTime } from '@/lib/format-date';
import { AgeSummary } from '@/components/age-summary';

function formatDistance(distanceM: number) {
  return distanceM < 1_000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1_000).toFixed(1)} km`;
}

export function PlanCard({ plan }: { plan: NearbyPlan }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/plans/${plan.id}`)} style={({ pressed }) => pressed && styles.pressed}>
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.activityIcon}><Ionicons name="walk-outline" size={24} color={Brand.primary} /></View>
      <View style={styles.content}>
        <View style={styles.row}><ThemedText type="smallBold" style={styles.category}>{formatPlanTime(plan.startsAt)} · {plan.activityType}</ThemedText><ThemedText type="small" themeColor="textSecondary">{formatDistance(plan.distanceM)}</ThemedText></View>
        <ThemedText style={styles.title}>{plan.title}</ThemedText>
        <AgeSummary summary={plan.ageSummary} preferredAge={plan.preferredAge} outsidePreference={plan.viewerOutsidePreferredAge} />
        <View style={styles.meta}><ThemedText type="small" themeColor="textSecondary">{plan.joinedCount}/{plan.maxParticipants} attending</ThemedText><Ionicons name="chevron-forward" size={18} color={Brand.slate} /></View>
      </View>
    </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: 22, gap: Spacing.three, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Brand.border },
  activityIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { color: Brand.primary, textTransform: 'capitalize', flexShrink: 1 }, title: { fontWeight: '800', fontSize: 17 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
