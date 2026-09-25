import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

type DurationChoice = { label: string; minutes: number };
const baseDurations: DurationChoice[] = [{ label: '30 min', minutes: 30 }, { label: '1 hour', minutes: 60 }, { label: '2 hours', minutes: 120 }];
const distances = [{ label: '1 km', value: 1000 }, { label: '2 km', value: 2000 }, { label: '5 km', value: 5000 }];

function durationChoices() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 0, 0);
  const minutes = Math.floor((end.getTime() - now.getTime()) / 60_000);
  return minutes >= 30 && minutes <= 720 ? [...baseDurations, { label: 'Tonight', minutes }] : baseDurations;
}

export default function FreeScreen() {
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

  if (!coordinates) return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><View style={styles.locationHeader}><Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Back</ThemedText></Pressable><ThemedText type="subtitle">I&apos;m Free</ThemedText></View><View style={styles.location}><LocationPrompt /></View></SafeAreaView></ThemedView>;

  if (createAvailability.data) {
    const result = createAvailability.data;
    return (
      <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Back to Now</ThemedText></Pressable>
        <View style={styles.heading}><ThemedText type="subtitle">You&apos;re in Now mode</ThemedText><ThemedText themeColor="textSecondary">Until {formatPlanTime(result.expiresAt)}. Your exact location stays private.</ThemedText></View>
        {result.formingGroup && <FormingInviteCard group={result.formingGroup} />}
        {result.plans.length > 0 ? <View style={styles.section}><ThemedText type="smallBold">Forming near you</ThemedText>{result.plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}</View> : <ThemedView type="backgroundElement" style={styles.empty}><ThemedText type="smallBold">Nothing is forming yet</ThemedText>{result.compatiblePeople >= 2 ? <ThemedText themeColor="textSecondary">{result.compatiblePeople} people nearby are also free{result.sharedInterest ? ` for ${result.sharedInterest}` : ''}.</ThemedText> : <ThemedText themeColor="textSecondary">Be the first Host in this area. We won&apos;t invent activity around you.</ThemedText>}<Pressable onPress={() => router.push('/create')}><ThemedText type="linkPrimary">Host a plan</ThemedText></Pressable></ThemedView>}
        <Pressable onPress={() => createAvailability.reset()} style={styles.secondary}><ThemedText type="linkPrimary">Change availability</ThemedText></Pressable>
      </ScrollView></SafeAreaView></ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Cancel</ThemedText></Pressable>
      <View style={styles.heading}><ThemedText type="subtitle">I&apos;m Free</ThemedText><ThemedText themeColor="textSecondary">Tell HAO what works right now. This availability expires automatically.</ThemedText></View>
      <View style={styles.section}><ThemedText type="smallBold">For how long?</ThemedText><View style={styles.options}>{durations.map((item) => <Pressable key={item.label} onPress={() => setMinutes(item.minutes)} style={[styles.chip, minutes === item.minutes && styles.selected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</View></View>
      <View style={styles.section}><ThemedText type="smallBold">What sounds good?</ThemedText>{interests.isLoading ? <ActivityIndicator /> : <View style={styles.options}>{interests.data?.map((item) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(item.slug) }} key={item.slug} onPress={() => toggleInterest(item.slug)} style={[styles.chip, selected.includes(item.slug) && styles.selected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</View>}</View>
      <View style={styles.section}><ThemedText type="smallBold">How far?</ThemedText><View style={styles.options}>{distances.map((item) => <Pressable key={item.value} onPress={() => setMaxDistanceM(item.value)} style={[styles.chip, maxDistanceM === item.value && styles.selected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</View><ThemedText type="small" themeColor="textSecondary">Your raw location is never shown to other people.</ThemedText></View>
      {(createAvailability.error || interests.error) && <ThemedText type="small" style={styles.error}>{createAvailability.error?.message ?? interests.error?.message}</ThemedText>}
      <Pressable disabled={!selected.length || createAvailability.isPending} onPress={submit} style={[styles.primary, (!selected.length || createAvailability.isPending) && styles.disabled]}>{createAvailability.isPending ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryText}>See what&apos;s forming</ThemedText>}</Pressable>
    </ScrollView></SafeAreaView></ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 }, content: { padding: Spacing.four, paddingBottom: 100, gap: Spacing.four }, heading: { gap: Spacing.two }, section: { gap: Spacing.three }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, chip: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 22, borderWidth: 1, borderColor: '#C9CBD1', alignItems: 'center', justifyContent: 'center' }, selected: { borderColor: '#FF7A1A', backgroundColor: '#FFF0E5' }, primary: { minHeight: 54, borderRadius: 27, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, error: { color: '#B42318' }, empty: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two }, secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, locationHeader: { padding: Spacing.four, gap: Spacing.three }, location: { flex: 1, justifyContent: 'center', padding: Spacing.four },
});
