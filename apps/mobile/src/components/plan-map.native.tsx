import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useNearbyPlans } from '@/hooks/use-nearby-plans';
import { useLocationStore } from '@/stores/location-store';
import { userFacingError } from '@/lib/user-facing-error';

export function PlanMap() {
  const router = useRouter();
  const { t } = useTranslation();
  const coordinates = useLocationStore((state) => state.coordinates)!;
  const plans = useNearbyPlans();

  if (plans.isLoading) return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;
  if (plans.error) return <ThemedView style={styles.center}><ThemedText>{userFacingError(plans.error, t('nearby.loadErrorHelp'))}</ThemedText><Pressable onPress={() => void plans.refetch()}><ThemedText type="linkPrimary">{t('tryAgain')}</ThemedText></Pressable></ThemedView>;

  return (
    <ThemedView style={styles.container}>
      <MapView style={styles.map} showsUserLocation initialRegion={{ ...coordinates, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
        {plans.data?.map((plan) => <Circle key={plan.id} center={{ latitude: plan.latitude, longitude: plan.longitude }} radius={400} fillColor="rgba(255,122,26,0.18)" strokeColor="#FF7A1A" strokeWidth={2} />)}
      </MapView>
      {!plans.data?.length && (
        <ThemedView type="backgroundElement" style={styles.empty}>
          <ThemedText type="smallBold">{t('nearby.first')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('nearby.emptyShort')}</ThemedText>
          <Pressable onPress={() => router.push('/create')}><ThemedText type="linkPrimary">{t('nearby.createFast')}</ThemedText></Pressable>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, map: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  empty: { position: 'absolute', left: 16, right: 16, bottom: 100, padding: 20, borderRadius: 16, gap: 8 },
});
