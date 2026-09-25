import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { LocationPrompt } from '@/components/location-prompt';
import { PlanMap } from '@/components/plan-map';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLocationStore } from '@/stores/location-store';

export default function MapScreen() {
  const coordinates = useLocationStore((state) => state.coordinates);
  useEffect(() => {
    if (Platform.OS === 'web') window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  return <ThemedView style={styles.screen}>{coordinates ? <PlanMap /> : <ThemedView style={styles.prompt}><LocationPrompt /></ThemedView>}</ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, prompt: { flex: 1, justifyContent: 'center', padding: Spacing.four } });
