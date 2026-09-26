import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import type { AgeSummary as AgeSummaryValue, PreferredAge } from '@/types/age-band';

type Props = {
  summary: AgeSummaryValue | null;
  preferredAge: PreferredAge;
  outsidePreference?: boolean;
};

export function AgeSummary({ summary, preferredAge, outsidePreference = false }: Props) {
  const { t } = useTranslation();
  const summaryText = summary?.type === 'mostly'
    ? t('age.summary.mostly', { band: t(`age.band.${summary.band}`) })
    : summary?.type === 'range'
      ? t('age.summary.range', { from: t(`age.band.${summary.from}`), to: t(`age.band.${summary.to}`) })
      : t('age.summary.privateUntilThree');

  return (
    <View style={styles.row}>
      <Ionicons name="people-outline" size={15} color={Brand.slate} />
      <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.summary}>{summaryText}</ThemedText>
      {preferredAge !== 'any' && <View style={[styles.tag, outsidePreference && styles.outside]}><ThemedText numberOfLines={1} type="small" style={styles.tagText}>{t('age.pref.tag', { range: t(`age.pref.${preferredAge}`) })}</ThemedText></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  summary: { flexShrink: 1 },
  tag: { maxWidth: '48%', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Brand.primarySoft },
  outside: { backgroundColor: '#ECEEF2' },
  tagText: { color: Brand.navy, fontWeight: '700' },
});
