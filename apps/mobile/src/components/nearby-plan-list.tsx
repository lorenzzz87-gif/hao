import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlanCard } from '@/components/plan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useNearbyPlans } from '@/hooks/use-nearby-plans';
import { userFacingError } from '@/lib/user-facing-error';

export function NearbyPlanList() {
  const router = useRouter();
  const { t } = useTranslation();
  const plans = useNearbyPlans();

  if (plans.isLoading) return <ThemedView style={styles.center}><ActivityIndicator /><ThemedText type="small" themeColor="textSecondary">{t('nearby.loading')}</ThemedText></ThemedView>;
  if (plans.error) return <ThemedView type="backgroundElement" style={styles.state}><ThemedText type="smallBold">{t('nearby.loadError')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{userFacingError(plans.error, t('nearby.loadErrorHelp'))}</ThemedText><Pressable onPress={() => void plans.refetch()}><ThemedText type="linkPrimary">{t('tryAgain')}</ThemedText></Pressable></ThemedView>;
  if (!plans.data?.length) return <ThemedView type="backgroundElement" style={styles.state}><ThemedText style={styles.stateTitle}>{t('nearby.first')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('nearby.empty')}</ThemedText><Pressable onPress={() => router.push('/create')} style={styles.stateAction}><ThemedText style={styles.stateActionText}>{t('nearby.create')}</ThemedText></Pressable></ThemedView>;

  return <ThemedView style={styles.list}>{plans.data.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</ThemedView>;
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three }, center: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  state: { minHeight: 180, padding: Spacing.four, justifyContent: 'center', borderRadius: 24, gap: Spacing.two, borderWidth: 1, borderColor: Brand.border },
  stateTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800' },
  stateAction: { alignSelf: 'flex-start', marginTop: Spacing.two, minHeight: 42, borderRadius: 21, backgroundColor: Brand.primary, justifyContent: 'center', paddingHorizontal: Spacing.three },
  stateActionText: { color: '#FFFFFF', fontWeight: '800' },
});
