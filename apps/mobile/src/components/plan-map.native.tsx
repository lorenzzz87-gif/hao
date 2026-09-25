import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useNearbyPlans } from '@/hooks/use-nearby-plans';
import { useLocationStore } from '@/stores/location-store';

export function PlanMap() {
  const router = useRouter();
  const coordinates = useLocationStore((state) => state.coordinates)!;
  const plans = useNearbyPlans();

  if (plans.isLoading) return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;
  if (plans.error) return <ThemedView style={styles.center}><ThemedText>{plans.error.message}</ThemedText><Pressable onPress={() => void plans.refetch()}><ThemedText type="linkPrimary">Try again</ThemedText></Pressable></ThemedView>;

  return (
    <ThemedView style={styles.container}>
      <MapView style={styles.map} showsUserLocation initialRegion={{ ...coordinates, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
        {plans.data?.map((plan) => <Circle key={plan.id} center={{ latitude: plan.latitude, longitude: plan.longitude }} radius={400} fillColor="rgba(255,122,26,0.18)" strokeColor="#FF7A1A" strokeWidth={2} />)}
      </MapView>
      {!plans.data?.length && (
        <ThemedView type="backgroundElement" style={styles.empty}>
          <ThemedText type="smallBold">Be the first plan in this area</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Nothing nearby in the next six hours.</ThemedText>
          <Pressable onPress={() => router.push('/create')}><ThemedText type="linkPrimary">Create in 20 seconds</ThemedText></Pressable>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, map: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  empty: { position: 'absolute', left: 16, right: 16, bottom: 100, padding: 20, borderRadius: 16, gap: 8 },
});
