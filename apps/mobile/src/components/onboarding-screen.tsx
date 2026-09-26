import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import i18n from '@/lib/i18n';
import { userFacingError } from '@/lib/user-facing-error';

const languages = [{ code: 'en', label: 'English' }, { code: 'it', label: 'Italiano' }, { code: 'zh', label: '中文' }];

export function OnboardingScreen({ onCompleted }: { onCompleted: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [language, setLanguage] = useState('en');
  const [selected, setSelected] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interests = useQuery({
    queryKey: ['interests'],
    queryFn: async () => {
      const result = await supabase.from('interests').select('slug,label').order('id');
      if (result.error) throw result.error;
      return result.data;
    },
  });

  function toggleInterest(slug: string) {
    setSelected((current) => current.includes(slug) ? current.filter((item) => item !== slug) : current.length < 5 ? [...current, slug] : current);
  }

  async function complete() {
    setBusy(true);
    setError(null);
    const termsResult = await supabase.rpc('accept_community_terms', { p_version: '2026-09-24' });
    if (termsResult.error) {
      setBusy(false);
      setError(userFacingError(termsResult.error, t('onboarding.termsError')));
      return;
    }
    const { error: submitError } = await supabase.rpc('complete_onboarding', {
      display_name: name.trim(), birth_date: birthDate, primary_language: language, interest_slugs: selected,
    });
    setBusy(false);
    if (submitError) setError(userFacingError(submitError, t('onboarding.profileError')));
    else { await i18n.changeLanguage(language); onCompleted(); }
  }

  const valid = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && selected.length >= 3 && selected.length <= 5 && acceptedTerms;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">{t('onboarding.title')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('onboarding.subtitle')}</ThemedText>
          <TextInput accessibilityLabel={t('onboarding.displayName')} placeholder={t('onboarding.displayName')} value={name} onChangeText={setName} style={styles.input} maxLength={60} />
          <TextInput accessibilityLabel={t('onboarding.birthDate')} placeholder={t('onboarding.birthDatePlaceholder')} value={birthDate} onChangeText={setBirthDate} style={styles.input} keyboardType="numbers-and-punctuation" maxLength={10} />
          <ThemedText type="smallBold">{t('onboarding.primaryLanguage')}</ThemedText>
          <ThemedView style={styles.options}>{languages.map((item) => <Pressable key={item.code} onPress={() => setLanguage(item.code)} style={[styles.chip, language === item.code && styles.chipSelected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</ThemedView>
          <ThemedText type="smallBold">{t('onboarding.chooseInterests')}</ThemedText>
          {interests.isLoading ? <ActivityIndicator /> : <ThemedView style={styles.options}>{interests.data?.map((item) => <Pressable key={item.slug} onPress={() => toggleInterest(item.slug)} style={[styles.chip, selected.includes(item.slug) && styles.chipSelected]}><ThemedText type="small">{item.label}</ThemedText></Pressable>)}</ThemedView>}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} onPress={() => setAcceptedTerms((value) => !value)} style={styles.terms}><ThemedView style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}><ThemedText style={styles.checkmark}>{acceptedTerms ? '✓' : ''}</ThemedText></ThemedView><ThemedText type="small" style={styles.termsText}>{t('onboarding.terms')}</ThemedText></Pressable>
          {(error || interests.error) && <ThemedText type="small" style={styles.error}>{error ?? userFacingError(interests.error, t('onboarding.interestsError'))}</ThemedText>}
          <Pressable accessibilityRole="button" disabled={!valid || busy} onPress={complete} style={[styles.button, (!valid || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.buttonText}>{t('onboarding.enter')}</ThemedText>}</Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: { padding: Spacing.four, gap: Spacing.three },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#C9CBD1', borderRadius: 14, paddingHorizontal: Spacing.three, backgroundColor: '#FFFFFF', color: '#111111', fontSize: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 20, borderWidth: 1, borderColor: '#C9CBD1' },
  chipSelected: { borderColor: '#FF7A1A', backgroundColor: '#FFF0E5' },
  button: { minHeight: 54, borderRadius: 27, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, error: { color: '#B42318' },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two }, checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: '#92949B', alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { backgroundColor: '#FF7A1A', borderColor: '#FF7A1A' }, checkmark: { color: '#FFFFFF', fontWeight: '900' }, termsText: { flex: 1 },
});
