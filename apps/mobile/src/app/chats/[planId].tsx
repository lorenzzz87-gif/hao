import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlanMessages, useSendPlanMessage } from '@/hooks/use-plan-chat';
import { usePlanDetail } from '@/hooks/use-plan-detail';
import { DEMO_USER_ID } from '@/lib/demo-chat';
import { useSessionStore } from '@/stores/session-store';
import type { PlanMessage } from '@/types/plan-message';
import { useTranslateContent } from '@/hooks/use-translation';

const quickReplies = ["I'm on my way", "I'm here", "I'll be 5 min late", "Can't make it"] as const;

export default function PlanChatScreen() {
  const params = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const demoMode = useSessionStore((state) => state.demoMode);
  const sessionUserId = useSessionStore((state) => state.session?.user.id);
  const userId = demoMode ? DEMO_USER_ID : sessionUserId;
  const messages = usePlanMessages(planId ?? '');
  const plan = usePlanDetail(planId ?? '');
  const sendMessage = useSendPlanMessage(planId ?? '');
  const [draft, setDraft] = useState('');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const translation = useTranslateContent();
  const listRef = useRef<FlatList<PlanMessage>>(null);
  const memberNames = useMemo(
    () => new Map(plan.data?.members.map((member) => [member.id, member.display_name ?? 'HAO member']) ?? []),
    [plan.data?.members],
  );

  const send = async (body: string, type: 'text' | 'quick_action') => {
    const trimmed = body.trim();
    if (!trimmed || sendMessage.isPending) return;
    try {
      await sendMessage.mutateAsync({ body: trimmed, type });
      if (type === 'text') setDraft('');
    } catch {
      // The mutation exposes the error below and the draft remains available to retry.
    }
  };

  if (messages.isLoading || plan.isLoading) {
    return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;
  }

  if (messages.error || plan.error || !plan.data?.is_joined) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">Chat unavailable</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{messages.error?.message ?? plan.error?.message ?? 'Join this plan to access its group chat.'}</ThemedText>
        <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Go back</ThemedText></Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Back</ThemedText></Pressable>
            <View style={styles.headerCopy}><ThemedText type="smallBold" numberOfLines={1}>{plan.data.title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{plan.data.joined_count} people</ThemedText></View>
          </View>
          <FlatList
            ref={listRef}
            data={messages.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>Say hello and coordinate the meetup.</ThemedText>}
            renderItem={({ item }) => {
              if (item.message_type === 'system') return <ThemedText type="small" themeColor="textSecondary" style={styles.system}>{item.body}</ThemedText>;
              const own = item.sender_id === userId;
              return (
                <View style={[styles.messageRow, own && styles.ownMessageRow]}>
                  {!own && <ThemedText type="small" themeColor="textSecondary">{item.sender_id ? memberNames.get(item.sender_id) ?? 'HAO member' : 'HAO'}</ThemedText>}
                  <Pressable disabled={own} onLongPress={demoMode ? undefined : () => router.push({ pathname: '/safety/report', params: { targetType: 'message', targetId: item.id, targetName: 'this message' } })}><View style={[styles.bubble, own && styles.ownBubble]}><ThemedText style={own ? styles.ownText : undefined}>{translations[item.id] ?? item.body}</ThemedText>{translations[item.id] && <ThemedText type="small" style={own ? styles.ownOriginal : styles.original}>Original: {item.body}</ThemedText>}</View></Pressable>
                  {!demoMode && <View style={styles.messageTools}><Pressable disabled={translation.isPending} onPress={() => void translation.mutateAsync({ contentType: 'message', contentId: item.id }).then((result) => setTranslations((current) => ({ ...current, [item.id]: result.translatedText }))).catch(() => undefined)}><ThemedText type="small" style={styles.toolText}>{translation.isPending ? 'Translating…' : 'Translate'}</ThemedText></Pressable>{!own && <ThemedText type="small" themeColor="textSecondary">Press and hold to report</ThemedText>}</View>}
                </View>
              );
            }}
          />
          <View style={styles.composer}>
            <View style={styles.quickReplies}>{quickReplies.map((reply) => <Pressable key={reply} disabled={sendMessage.isPending} onPress={() => void send(reply, 'quick_action')} style={styles.quickReply}><ThemedText type="small">{reply}</ThemedText></Pressable>)}</View>
            {sendMessage.error && <ThemedText type="small" style={styles.error}>{sendMessage.error.message}</ThemedText>}
            {!demoMode && (translation.error || translation.languageError) && <ThemedText type="small" style={styles.error}>{translation.error?.message ?? translation.languageError?.message}</ThemedText>}
            <View style={styles.inputRow}>
              <TextInput value={draft} onChangeText={setDraft} maxLength={2000} multiline placeholder="Message the group" placeholderTextColor="#777777" style={styles.input} />
              <Pressable accessibilityRole="button" disabled={!draft.trim() || sendMessage.isPending} onPress={() => void send(draft, 'text')} style={[styles.send, (!draft.trim() || sendMessage.isPending) && styles.disabled]}><ThemedText style={styles.sendText}>Send</ThemedText></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 }, keyboard: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  header: { minHeight: 64, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#B8B8B8' }, headerCopy: { flex: 1 },
  messages: { flexGrow: 1, padding: Spacing.four, gap: Spacing.three }, empty: { textAlign: 'center', marginTop: Spacing.six }, system: { textAlign: 'center', paddingVertical: Spacing.one },
  messageRow: { maxWidth: '82%', alignSelf: 'flex-start', gap: Spacing.one }, ownMessageRow: { alignSelf: 'flex-end' }, bubble: { backgroundColor: '#F0F0F3', borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }, ownBubble: { backgroundColor: '#FF7A1A' }, ownText: { color: '#FFFFFF' },
  messageTools: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }, toolText: { color: '#E9660B' }, original: { color: '#60646C', marginTop: Spacing.one }, ownOriginal: { color: '#FFF0E5', marginTop: Spacing.one },
  composer: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.two, gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#B8B8B8' }, quickReplies: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, quickReply: { borderWidth: 1, borderColor: '#B8B8B8', borderRadius: 18, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two }, input: { flex: 1, minHeight: 44, maxHeight: 112, borderWidth: 1, borderColor: '#B8B8B8', borderRadius: 22, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, color: '#111111', backgroundColor: '#FFFFFF' },
  send: { minHeight: 44, minWidth: 64, borderRadius: 22, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' }, sendText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, error: { color: '#B42318' },
});
