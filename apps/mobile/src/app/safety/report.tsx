import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { type ReportReason, type ReportTarget, useBlockUser, useReportTarget } from '@/hooks/use-safety';
import { userFacingError } from '@/lib/user-facing-error';

const reasons: ReportReason[] = ['harassment', 'hate_or_abuse', 'unsafe_meetup', 'spam_or_scam', 'other'];

export default function ReportScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ targetType: ReportTarget; targetId: string; targetName?: string }>();
  const router = useRouter();
  const targetType = Array.isArray(params.targetType) ? params.targetType[0] : params.targetType;
  const targetId = Array.isArray(params.targetId) ? params.targetId[0] : params.targetId;
  const targetName = Array.isArray(params.targetName) ? params.targetName[0] : params.targetName;
  const report = useReportTarget();
  const block = useBlockUser();
  const [reason, setReason] = useState<ReportReason>();
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const validTarget = ['user', 'plan', 'message'].includes(targetType ?? '') && Boolean(targetId);

  const submit = async () => {
    if (!reason || !targetType || !targetId) return;
    try {
      await report.mutateAsync({ targetType, targetId, reason, details });
      setSubmitted(true);
    } catch {
      // Inline error below keeps the selected reason and details available to retry.
    }
  };

  const confirmBlock = () => {
    if (!targetId) return;
    Alert.alert(t('report.blockTitle'), t('report.blockBody'), [
      { text: t('report.cancel'), style: 'cancel' },
      { text: t('report.blockPerson'), style: 'destructive', onPress: () => void block.mutateAsync(targetId).then(() => router.replace('/')).catch(() => undefined) },
    ]);
  };

  if (!validTarget) return <ThemedView style={styles.center}><ThemedText type="smallBold">{t('report.invalid')}</ThemedText><Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">{t('report.goBack')}</ThemedText></Pressable></ThemedView>;
  if (submitted) return <ThemedView style={styles.center}><ThemedText type="subtitle">{t('report.received')}</ThemedText><ThemedText themeColor="textSecondary" style={styles.centerText}>{t('report.receivedBody')}</ThemedText><Pressable onPress={() => router.back()} style={styles.primary}><ThemedText style={styles.primaryText}>{t('report.done')}</ThemedText></Pressable></ThemedView>;

  return (
    <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">{t('report.cancel')}</ThemedText></Pressable>
      <View style={styles.heading}><ThemedText type="subtitle">{t(`report.title.${targetType}`)}</ThemedText><ThemedText themeColor="textSecondary">{targetName ? t('report.withName', { name: targetName }) : t('report.whatHappened')} {t('report.private')}</ThemedText></View>
      <View style={styles.options}>{reasons.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: reason === item }} key={item} onPress={() => setReason(item)} style={[styles.option, reason === item && styles.selected]}><ThemedText type="smallBold">{t(`report.reason.${item}`)}</ThemedText></Pressable>)}</View>
      <View style={styles.field}><ThemedText type="smallBold">{t('report.details')}</ThemedText><TextInput accessibilityLabel={t('report.details')} value={details} onChangeText={setDetails} maxLength={1000} multiline placeholder={t('report.detailsPlaceholder')} placeholderTextColor="#777777" style={styles.input} /><ThemedText type="small" themeColor="textSecondary">{details.length}/1000</ThemedText></View>
      {report.error && <ThemedText type="small" style={styles.error}>{userFacingError(report.error, t('report.submitError'))}</ThemedText>}
      <Pressable disabled={!reason || report.isPending} onPress={() => void submit()} style={[styles.primary, (!reason || report.isPending) && styles.disabled]}>{report.isPending ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryText}>{t('report.submit')}</ThemedText>}</Pressable>
      {targetType === 'user' && <View style={styles.blockArea}><ThemedText type="smallBold">{t('report.separation')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('report.blockHelp')}</ThemedText>{block.error && <ThemedText type="small" style={styles.error}>{userFacingError(block.error, t('report.blockError'))}</ThemedText>}<Pressable disabled={block.isPending} onPress={confirmBlock} style={styles.blockButton}><ThemedText style={styles.blockText}>{block.isPending ? t('report.blocking') : t('report.blockPerson')}</ThemedText></Pressable></View>}
    </ScrollView></SafeAreaView></ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 }, content: { padding: Spacing.four, paddingBottom: 80, gap: Spacing.four }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three }, centerText: { textAlign: 'center', maxWidth: 420 }, heading: { gap: Spacing.two }, options: { gap: Spacing.two }, option: { minHeight: 52, borderWidth: 1, borderColor: '#B8B8B8', borderRadius: Spacing.three, paddingHorizontal: Spacing.three, justifyContent: 'center' }, selected: { borderColor: '#FF7A1A', backgroundColor: '#FFF0E5' }, field: { gap: Spacing.two }, input: { minHeight: 120, borderWidth: 1, borderColor: '#B8B8B8', borderRadius: Spacing.three, padding: Spacing.three, color: '#111111', backgroundColor: '#FFFFFF', textAlignVertical: 'top', fontSize: 16 }, primary: { minHeight: 54, minWidth: 180, borderRadius: 27, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four }, primaryText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, error: { color: '#B42318' }, blockArea: { marginTop: Spacing.two, paddingTop: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#B8B8B8', gap: Spacing.two }, blockButton: { minHeight: 48, borderWidth: 1, borderColor: '#B42318', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, blockText: { color: '#B42318', fontWeight: '700' },
});
