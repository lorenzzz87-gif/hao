import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useRespondToFormingGroup } from '@/hooks/use-forming-group';
import type { FormingGroup } from '@/types/forming-group';

export function FormingInviteCard({ group }: { group: FormingGroup }) {
  const { t } = useTranslation();
  const router = useRouter();
  const respond = useRespondToFormingGroup();
  const activity = t(`forming.activity.${group.activityType}`, { defaultValue: group.activityType.replaceAll('_', ' ') });

  const accept = () => {
    respond.mutate({ groupId: group.id, accept: true }, {
      onSuccess: (planId) => { if (planId) router.push(`/plans/${planId}`); },
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.signal}><View style={styles.dot} /><ThemedText style={styles.signalText}>{t('forming.signal')}</ThemedText></View>
      <ThemedText style={styles.title}>{t('forming.title', { count: group.memberCount, activity })}</ThemedText>
      <ThemedText style={styles.body}>{t('forming.body')}</ThemedText>
      {respond.error && <ThemedText type="small" style={styles.error}>{t('forming.error')}</ThemedText>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={respond.isPending} onPress={accept} style={styles.accept}>
          {respond.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><ThemedText style={styles.acceptText}>{t('forming.accept')}</ThemedText><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={respond.isPending} onPress={() => respond.mutate({ groupId: group.id, accept: false })} style={styles.decline}>
          <ThemedText type="small" style={styles.declineText}>{t('forming.decline')}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.four, borderRadius: 28, backgroundColor: Brand.navy, gap: Spacing.three },
  signal: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.primary },
  signalText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 27, lineHeight: 32, fontWeight: '800' },
  body: { color: '#D0D5DD', fontSize: 15, lineHeight: 22 },
  actions: { gap: Spacing.two },
  accept: { minHeight: 52, paddingHorizontal: Spacing.four, borderRadius: 26, backgroundColor: Brand.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  acceptText: { color: '#FFFFFF', fontWeight: '800' },
  decline: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  declineText: { color: '#D0D5DD', fontWeight: '700' },
  error: { color: '#FDA29B' },
});
