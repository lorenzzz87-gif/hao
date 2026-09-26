import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LocationPrompt } from '@/components/location-prompt';
import { FormingInviteCard } from '@/components/forming-invite-card';
import { PlanCard } from '@/components/plan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCreateAvailability } from '@/hooks/use-availability';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/stores/location-store';
import { formatPlanTime } from '@/lib/format-date';
import { userFacingError } from '@/lib/user-facing-error';

type DurationChoice = { key: string; minutes: number };
const baseDurations: DurationChoice[] = [{ key: 'min30', minutes: 30 }, { key: 'hour1', minutes: 60 }, { key: 'hours2', minutes: 120 }];
const distances = [{ label: '1 km', value: 1000 }, { label: '2 km', value: 2000 }, { label: '5 km', value: 5000 }];

function durationChoices() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 0, 0);
  const minutes = Math.floor((end.getTime() - now.getTime()) / 60_000);
  return minutes >= 30 && minutes <= 720 ? [...baseDurations, { key: 'tonight', minutes }] : baseDurations;
}

export default function FreeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const coordinates = useLocationStore((state) => state.coordinates);
  const createAvailability = useCreateAvailability();
  const [minutes, setMinutes] = useState(60);
  const [maxDistanceM, setMaxDistanceM] = useState(2000);
  const [selected, setSelected] = useState<string[]>([]);
  const durations = useMemo(durationChoices, []);
  const interests = useQuery({
    queryKey: ['interests'],
    queryFn: async () => {
      const result = await supabase.from('interests').select('slug,label').order('id');
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const toggleInterest = (slug: string) => setSelected((current) => {
    if (current.includes(slug)) return current.filter((item) => item !== slug);
    if (slug === 'anything') return ['anything'];
    return [...current.filter((item) => item !== 'anything'), slug];
  });

  const submit = () => {
    if (!coordinates || !selected.length) return;
    createAvailability.mutate({
      expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      maxDistanceM,
      interests: selected,
    });
  };

  if (!coordinates) return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><View style={styles.locationHeader}><Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">{t('freeScreen.back')}</ThemedText></Pressable><ThemedText type="subtitle">{t('freeScreen.title')}</ThemedText></View><View style={styles.location}><LocationPrompt /></View></SafeAreaView></ThemedView>;

  if (createAvailability.data) {
    const result = createAvailability.data;
    return (
      <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">{t('freeScreen.backNow')}</ThemedText></Pressable>
        <View style={styles.heading}><ThemedText type="subtitle">{t('freeScreen.activeTitle')}</ThemedText><ThemedText themeColor="textSecondary">{t('freeScreen.activeUntil', { time: formatPlanTime(result.expiresAt) })}</ThemedText></View>
        {result.formingGroup && <FormingInviteCard group={result.formingGroup} />}
        {result.plans.length > 0 ? <View style={styles.section}><ThemedText type="smallBold">{t('freeScreen.formingNearby')}</ThemedText>{result.plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</View> : <ThemedView type="backgroundElement" style={styles.empty}><ThemedText type="smallBold">{t('freeScreen.nothingYet')}</ThemedText>{result.compatiblePeople >= 2 ? <ThemedText themeColor="textSecondary">{t('freeScreen.peopleFree', { count: result.compatiblePeople, interest: result.sharedInterest ? ` · ${result.sharedInterest}` : '' })}</ThemedText> : <ThemedText themeColor="textSecondary">{t('freeScreen.firstHost')}</ThemedText>}<Pressable onPress={() => router.push('/create')}><ThemedText type="linkPrimary">{t('freeScreen.hostPlan')}</ThemedText></Pressable></ThemedView>}
        <Pressable onPress={() => createAvailability.reset()} style={styles.secondary}><ThemedText type="linkPrimary">{t('freeScreen.change')}</ThemedText></Pressable>
      </ScrollView></SafeAreaView></ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">{t('freeScreen.cancel')}</ThemedText></Pressable>
      <View style={styles.heading}><ThemedText type="subtitle">{t('freeScreen.title')}</ThemedText><ThemedText themeColor="textSecondary">{t('freeScreen.subtitle')}</ThemedText></View>
      <View style={styles.section}><ThemedText type="smallBold">{t('freeScreen.duration')}</ThemedText><View style={styles.options}>{durations.map((item) => <Pressable key={item.key} onPress={() => setMinutes(item.minutes)} style={[styles.chip, minutes === item.minutes && styles.selected]}><ThemedText type="small">{t(`freeScreen.${item.key}`)}</ThemedText></Pressable>)}</View></View>
      <View style={styles.section}><ThemedText type="smallBold">{t('freeScreen.interests')}</ThemedText>{interests.isLoading ? <ActivityIndicator /> : <View style={styles.options}>{interests.data?.map((item) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(item.slug) }} key={item.slug} onPress={() => toggleInterest(item.slug)} style={[styles.chip, selected.includes(item.slug) && styles.selected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</View>}</View>
      <View style={styles.section}><ThemedText type="smallBold">{t('freeScreen.distance')}</ThemedText><View style={styles.options}>{distances.map((item) => <Pressable key={item.value} onPress={() => setMaxDistanceM(item.value)} style={[styles.chip, maxDistanceM === item.value && styles.selected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</View><ThemedText type="small" themeColor="textSecondary">{t('freeScreen.locationPrivacy')}</ThemedText></View>
      {(createAvailability.error || interests.error) && <ThemedText type="small" style={styles.error}>{userFacingError(createAvailability.error ?? interests.error, t('freeScreen.error'))}</ThemedText>}
      <Pressable disabled={!selected.length || createAvailability.isPending} onPress={submit} style={[styles.primary, (!selected.length || createAvailability.isPending) && styles.disabled]}>{createAvailability.isPending ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryText}>{t('freeScreen.submit')}</ThemedText>}</Pressable>
    </ScrollView></SafeAreaView></ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 }, content: { padding: Spacing.four, paddingBottom: 100, gap: Spacing.four }, heading: { gap: Spacing.two }, section: { gap: Spacing.three }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, chip: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 22, borderWidth: 1, borderColor: '#C9CBD1', alignItems: 'center', justifyContent: 'center' }, selected: { borderColor: '#FF7A1A', backgroundColor: '#FFF0E5' }, primary: { minHeight: 54, borderRadius: 27, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, error: { color: '#B42318' }, empty: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two }, secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, locationHeader: { padding: Spacing.four, gap: Spacing.three }, location: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
