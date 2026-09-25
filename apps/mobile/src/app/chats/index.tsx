import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMyPlanChats } from '@/hooks/use-plan-chat';
import { formatPlanDateTime } from '@/lib/format-date';
import { userFacingError } from '@/lib/user-facing-error';

export default function ChatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const chats = useMyPlanChats();
  return (
    <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
      <ThemedText style={styles.eyebrow}>{t('orbit.eyebrow')}</ThemedText>
      <ThemedText type="subtitle">{t('orbit.title')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('orbit.subtitle')}</ThemedText>
      {chats.isLoading && <ActivityIndicator />}
      {chats.error && <ThemedView type="backgroundElement" style={styles.state}><ThemedText type="smallBold">{t('orbit.loadError')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{userFacingError(chats.error, t('orbit.loadError'))}</ThemedText><Pressable onPress={() => void chats.refetch()}><ThemedText type="linkPrimary">{t('tryAgain')}</ThemedText></Pressable></ThemedView>}
      {!chats.isLoading && !chats.error && !chats.data?.length && <ThemedView type="backgroundElement" style={styles.state}><ThemedText type="smallBold">{t('orbit.emptyTitle')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('orbit.emptyBody')}</ThemedText><Pressable onPress={() => router.push('/')}><ThemedText type="linkPrimary">{t('orbit.discover')}</ThemedText></Pressable></ThemedView>}
      {chats.data?.map((chat) => <Pressable key={chat.plan_id} onPress={() => router.push(`/chats/${chat.plan_id}`)}><ThemedView type="backgroundElement" style={styles.chat}><ThemedText type="smallBold">{chat.title}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{chat.last_message ?? t('orbit.chatReady')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{formatPlanDateTime(chat.starts_at)}</ThemedText></ThemedView></Pressable>)}
    </ScrollView></SafeAreaView></ThemedView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 }, content: { padding: Spacing.four, paddingBottom: 100, gap: Spacing.three }, eyebrow: { color: Brand.primary, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.5 }, state: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: Brand.border }, chat: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one, borderWidth: 1, borderColor: Brand.border } });
