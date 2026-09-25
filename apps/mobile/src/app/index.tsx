import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { FormingInviteCard } from '@/components/forming-invite-card';
import { LocationPrompt } from '@/components/location-prompt';
import { NearbyPlanList } from '@/components/nearby-plan-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMyFormingGroup } from '@/hooks/use-forming-group';
import { useLocationStore } from '@/stores/location-store';
import { useTranslation } from 'react-i18next';

export default function NowScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const coordinates = useLocationStore((state) => state.coordinates);
  const formingGroup = useMyFormingGroup();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <BrandMark width={88} />
            <View style={styles.locationPill}><View style={styles.signalDot} /><ThemedText type="smallBold" themeColor="textSecondary">{t('home.nearby')}</ThemedText></View>
          </View>
          <View style={styles.heading}>
            <ThemedText style={styles.heroTitle}>{t('home.hero')}</ThemedText>
            <ThemedText style={styles.heroSubtitle} themeColor="textSecondary">{t('home.subtitle')}</ThemedText>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/free')} style={({ pressed }) => [styles.freeAction, pressed && styles.freePressed]}>
            <View style={styles.freeCopy}><View style={styles.nowLabel}><View style={styles.smallSignalDot} /><ThemedText style={styles.nowLabelText}>HAO</ThemedText></View><ThemedText style={styles.freeActionText}>{t('home.free')}</ThemedText><ThemedText style={styles.freeActionHint}>{t('home.forming')}</ThemedText></View>
            <View style={styles.arrowButton}><Ionicons name="arrow-forward" size={24} color={Brand.navy} /></View>
          </Pressable>
          {formingGroup.data && <FormingInviteCard group={formingGroup.data} />}
          <View style={styles.sectionHeader}><ThemedText style={styles.sectionTitle}>{t('home.plans')}</ThemedText>{coordinates && <Pressable onPress={() => router.push('/explore')}><ThemedText style={styles.seeAll}>{t('home.seeMap')}</ThemedText></Pressable>}</View>
          {coordinates ? <NearbyPlanList /> : <LocationPrompt />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: BottomTabInset + 104, gap: Spacing.four },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, minHeight: 36, borderRadius: 18, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border },
  signalDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.primary },
  heading: { gap: Spacing.two, marginTop: Spacing.two },
  heroTitle: { fontSize: 36, lineHeight: 38, fontWeight: '900', letterSpacing: -1.4, maxWidth: 430 },
  heroSubtitle: { fontSize: 17, lineHeight: 25 },
  freeAction: { minHeight: 144, borderRadius: 28, backgroundColor: Brand.navy, padding: Spacing.four, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freePressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  freeCopy: { gap: 6 }, nowLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 }, smallSignalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.primary }, nowLabelText: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, fontWeight: '900', letterSpacing: 1.3 }, freeActionText: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '900' }, freeActionHint: { color: '#D9DEE7', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  arrowButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  sectionTitle: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6 },
  seeAll: { color: Brand.primary, fontWeight: '800' },
});
