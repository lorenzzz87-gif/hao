import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMyPlanChats } from '@/hooks/use-plan-chat';
import { formatPlanDateTime } from '@/lib/format-date';

export default function ChatsScreen() {
  const router = useRouter();
  const chats = useMyPlanChats();
  return (
    <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
      <ThemedText style={styles.eyebrow}>ORBIT</ThemedText>
      <ThemedText type="subtitle">Your circles</ThemedText>
      <ThemedText themeColor="textSecondary">Coordinate plans you&apos;re attending.</ThemedText>
      {chats.isLoading && <ActivityIndicator />}
      {chats.error && <ThemedView type="backgroundElement" style={styles.state}><ThemedText type="smallBold">Orbits couldn&apos;t load</ThemedText><ThemedText type="small" themeColor="textSecondary">{chats.error.message}</ThemedText><Pressable onPress={() => void chats.refetch()}><ThemedText type="linkPrimary">Try again</ThemedText></Pressable></ThemedView>}
      {!chats.isLoading && !chats.error && !chats.data?.length && <ThemedView type="backgroundElement" style={styles.state}><ThemedText type="smallBold">No active Orbits yet</ThemedText><ThemedText type="small" themeColor="textSecondary">Attend a nearby plan to open a temporary group.</ThemedText><Pressable onPress={() => router.push('/')}><ThemedText type="linkPrimary">See what&apos;s happening</ThemedText></Pressable></ThemedView>}
      {chats.data?.map((chat) => <Pressable key={chat.plan_id} onPress={() => router.push(`/chats/${chat.plan_id}`)}><ThemedView type="backgroundElement" style={styles.chat}><ThemedText type="smallBold">{chat.title}</ThemedText><ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{chat.last_message ?? 'Plan chat is ready'}</ThemedText><ThemedText type="small" themeColor="textSecondary">{formatPlanDateTime(chat.starts_at)}</ThemedText></ThemedView></Pressable>)}
    </ScrollView></SafeAreaView></ThemedView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 }, content: { padding: Spacing.four, paddingBottom: 100, gap: Spacing.three }, eyebrow: { color: Brand.primary, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.5 }, state: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: Brand.border }, chat: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one, borderWidth: 1, borderColor: Brand.border } });
