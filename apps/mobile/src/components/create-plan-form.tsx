import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { userFacingError } from '@/lib/user-facing-error';
import { useLocationStore } from '@/stores/location-store';

type TimeChoice = { key: string; minutes: number };
const baseTimes: TimeChoice[] = [{ key: 'in30', minutes: 30 }, { key: 'in1h', minutes: 60 }, { key: 'in2h', minutes: 120 }];

function getTimeChoices(): TimeChoice[] {
  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(19, 0, 0, 0);
  const minutes = Math.round((tonight.getTime() - now.getTime()) / 60_000);
  return minutes >= 15 && minutes <= 360 ? [...baseTimes, { key: 'tonight', minutes }] : baseTimes;
}

export function CreatePlanForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const coordinates = useLocationStore((state) => state.coordinates)!;
  const [activity, setActivity] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeChoices = useMemo(getTimeChoices, []);
  const interests = useQuery({
    queryKey: ['interests'],
    queryFn: async () => {
      const result = await supabase.from('interests').select('slug,label').order('id');
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const valid = Boolean(activity && venueName.trim() && note.length <= 1000);

  async function submit() {
    if (!activity || !valid) return;
    setBusy(true);
    setError(null);
    const startsAt = new Date(Date.now() + minutes * 60_000).toISOString();
    const result = await supabase.rpc('create_plan', {
      p_activity_type: activity,
      p_starts_at: startsAt,
      p_venue_name: venueName.trim(),
      p_venue_address: venueAddress.trim(),
      p_latitude: coordinates.latitude,
      p_longitude: coordinates.longitude,
      p_max_participants: maxParticipants,
      p_note: note.trim(),
      p_title: null,
    });
    setBusy(false);
    if (result.error) {
      setError(userFacingError(result.error, t('createPlan.createError')));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['nearby-plans'] });
    router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <ThemedText type="smallBold">{t('createPlan.activity')}</ThemedText>
        {interests.isLoading ? <ActivityIndicator /> : <ThemedView style={styles.options}>{interests.data?.filter((item) => item.slug !== 'anything').map((item) => <Pressable key={item.slug} onPress={() => setActivity(item.slug)} style={[styles.chip, activity === item.slug && styles.chipSelected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</ThemedView>}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('createPlan.when')}</ThemedText>
        <ThemedView style={styles.options}>{timeChoices.map((choice) => <Pressable key={choice.key} onPress={() => setMinutes(choice.minutes)} style={[styles.chip, minutes === choice.minutes && styles.chipSelected]}><ThemedText type="small">{t(`createPlan.${choice.key}`)}</ThemedText></Pressable>)}</ThemedView>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('createPlan.publicPlace')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t('createPlan.placeHelp')}</ThemedText>
        <TextInput accessibilityLabel={t('createPlan.venueName')} placeholder={t('createPlan.venueName')} value={venueName} onChangeText={setVenueName} maxLength={120} style={styles.input} />
        <TextInput accessibilityLabel={t('createPlan.venueAddress')} placeholder={t('createPlan.venueAddress')} value={venueAddress} onChangeText={setVenueAddress} maxLength={240} style={styles.input} />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('createPlan.groupSize')}</ThemedText>
        <ThemedView style={styles.counter}>
          <Pressable accessibilityLabel={t('createPlan.decrease')} onPress={() => setMaxParticipants((value) => Math.max(2, value - 1))} style={styles.counterButton}><ThemedText>−</ThemedText></Pressable>
          <ThemedText>{t('createPlan.people', { count: maxParticipants })}</ThemedText>
          <Pressable accessibilityLabel={t('createPlan.increase')} onPress={() => setMaxParticipants((value) => Math.min(12, value + 1))} style={styles.counterButton}><ThemedText>+</ThemedText></Pressable>
        </ThemedView>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('createPlan.addNote')}</ThemedText>
        <TextInput accessibilityLabel={t('createPlan.planNote')} placeholder={t('createPlan.optionalDetails')} value={note} onChangeText={setNote} maxLength={1000} multiline style={[styles.input, styles.note]} />
        <ThemedText type="small" themeColor="textSecondary">{note.length}/1000</ThemedText>
      </View>

      {(error || interests.error) && <ThemedText type="small" style={styles.error}>{error ?? userFacingError(interests.error, t('createPlan.activitiesError'))}</ThemedText>}
      <Pressable accessibilityRole="button" disabled={!valid || busy} onPress={() => void submit()} style={[styles.submit, (!valid || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.submitText}>{t('createPlan.host')}</ThemedText>}</Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingBottom: 120, gap: Spacing.four }, section: { gap: Spacing.two },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 20, borderWidth: 1, borderColor: Brand.border },
  chipSelected: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  input: { minHeight: 52, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: Spacing.three, backgroundColor: '#FFFFFF', color: Brand.navy, fontSize: 16 },
  note: { minHeight: 100, paddingTop: Spacing.three, textAlignVertical: 'top' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  counterButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
  submit: { minHeight: 54, borderRadius: 27, backgroundColor: Brand.navy, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, error: { color: '#B42318' },
});
