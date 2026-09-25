import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useLocationStore } from '@/stores/location-store';
import { useTranslation } from 'react-i18next';

const areas = [
  { label: 'Roma', latitude: 41.9028, longitude: 12.4964 },
  { label: 'Milano', latitude: 45.4642, longitude: 9.19 },
  { label: 'Napoli', latitude: 40.8518, longitude: 14.2681 },
  { label: 'Firenze', latitude: 43.7696, longitude: 11.2558 },
];

export function LocationPrompt() {
  const { t } = useTranslation();
  const status = useLocationStore((state) => state.status);
  const error = useLocationStore((state) => state.error);
  const locate = useLocationStore((state) => state.locate);
  const chooseArea = useLocationStore((state) => state.chooseArea);
  const denied = status === 'denied';
  const deniedOnWeb = denied && Platform.OS === 'web';

  function handleLocationAction() {
    if (denied && Platform.OS !== 'web') {
      void Linking.openSettings();
      return;
    }
    void locate();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.icon}><Ionicons name="location" size={24} color={Brand.primary} /></View>
      <View style={styles.copy}><ThemedText style={styles.title}>{t('location.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t('location.privacy')}</ThemedText>
      </View>
      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
      {deniedOnWeb && <ThemedView style={styles.webHelp}>
        <ThemedText type="smallBold">Allow location in Safari</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Tap the page menu beside the address bar → Website Settings → Location → Allow. Then come back and try again.</ThemedText>
      </ThemedView>}
      <Pressable accessibilityRole="button" disabled={status === 'loading'} onPress={handleLocationAction} style={[styles.button, status === 'loading' && styles.disabled]}>
        {status === 'loading' ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.buttonText}>{deniedOnWeb ? t('location.retry') : denied ? t('location.settings') : error ? t('location.retry') : t('location.use')}</ThemedText>}
      </Pressable>
      <View style={styles.divider}><View style={styles.line} /><ThemedText type="small" themeColor="textSecondary">{t('location.manual')}</ThemedText><View style={styles.line} /></View>
      <View style={styles.areas}>{areas.map((area) => <Pressable key={area.label} accessibilityRole="button" accessibilityLabel={`Browse ${area.label}`} onPress={() => chooseArea(area, area.label)} style={styles.areaButton}><ThemedText type="smallBold">{area.label}</ThemedText></Pressable>)}</View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.four, borderRadius: 24, gap: Spacing.three, borderWidth: 1, borderColor: Brand.border },
  icon: { width: 46, height: 46, borderRadius: 23, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: Spacing.two },
  webHelp: { gap: Spacing.one, padding: Spacing.three, borderRadius: 16, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  button: { minHeight: 52, borderRadius: 26, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.5 }, error: { color: '#B42318' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, line: { flex: 1, height: 1, backgroundColor: Brand.border },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, areaButton: { minHeight: 42, paddingHorizontal: Spacing.three, borderRadius: 21, borderWidth: 1, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
