import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CreatePlanForm } from '@/components/create-plan-form';
import { LocationPrompt } from '@/components/location-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLocationStore } from '@/stores/location-store';

export default function CreateScreen() {
  const { t } = useTranslation();
  const coordinates = useLocationStore((state) => state.coordinates);
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heading}><ThemedText type="subtitle">{t('createPlan.title')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('createPlan.subtitle')}</ThemedText></ThemedView>
        {coordinates ? <CreatePlanForm /> : <ThemedView style={styles.prompt}><LocationPrompt /></ThemedView>}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 },
  heading: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.one }, prompt: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
