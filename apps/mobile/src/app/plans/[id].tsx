import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCheckIn, usePlanCheckInStatus } from '@/hooks/use-check-in';
import { useCancelPlan, usePlanDetail, usePlanMembership } from '@/hooks/use-plan-detail';
import { useSessionStore } from '@/stores/session-store';
import { useTranslateContent } from '@/hooks/use-translation';
import { DEMO_USER_ID } from '@/lib/demo-chat';
import { userFacingError } from '@/lib/user-facing-error';
import { formatPlanDateTime } from '@/lib/format-date';

export default function PlanDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useSessionStore((state) => state.session?.user.id);
  const demoMode = useSessionStore((state) => state.demoMode);
  const viewerId = demoMode ? DEMO_USER_ID : userId;
  const planId = Array.isArray(params.id) ? params.id[0] : params.id;
  const plan = usePlanDetail(planId ?? '');
  const join = usePlanMembership(planId ?? '', 'join');
  const leave = usePlanMembership(planId ?? '', 'leave');
  const cancel = useCancelPlan(planId ?? '');
  const mutation = plan.data?.is_joined ? leave : join;
  const checkInStatus = usePlanCheckInStatus(planId ?? '', Boolean(plan.data?.is_joined));
  const checkIn = useCheckIn(planId ?? '');
  const translation = useTranslateContent();
  const [translatedTitle, setTranslatedTitle] = useState<string>();
  const [translatedNote, setTranslatedNote] = useState<string>();

  if (plan.isLoading) return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;
  if (plan.error || !plan.data) return <ThemedView style={styles.center}><ThemedText type="smallBold">Plan unavailable</ThemedText><ThemedText type="small" themeColor="textSecondary">{plan.error ? userFacingError(plan.error, 'This plan could not be found.') : 'This plan could not be found.'}</ThemedText><Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Go back</ThemedText></Pressable></ThemedView>;

  const data = plan.data;
  const joinable = data.status === 'open' || data.status === 'confirmed';
  const actionDisabled = mutation.isPending || data.is_creator || (!data.is_joined && (!joinable || data.seats_remaining === 0));
  const actionLabel = data.is_creator ? "You're hosting" : data.is_joined ? 'Leave plan' : data.status === 'cancelled' ? 'Plan cancelled' : data.status === 'completed' ? 'Plan completed' : data.status === 'started' ? 'Plan started' : data.status === 'full' || data.seats_remaining === 0 ? 'Plan is full' : 'Join plan';
  const now = Date.now();
  const checkInOpensAt = new Date(data.starts_at).getTime() - 30 * 60_000;
  const checkInClosesAt = new Date(data.expected_end_at ?? new Date(new Date(data.starts_at).getTime() + 2 * 60 * 60_000).toISOString()).getTime() + 30 * 60_000;
  const canCheckIn = data.is_joined && now >= checkInOpensAt && now <= checkInClosesAt && !checkInStatus.data?.self_checked_in;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">Back</ThemedText></Pressable>
          <View style={styles.header}><ThemedText type="smallBold" style={styles.category}>{data.activity_type}</ThemedText><ThemedText type="subtitle">{translatedTitle ?? data.title}</ThemedText>{translatedTitle && <ThemedText type="small" themeColor="textSecondary">Original: {data.title}</ThemedText>}<Pressable disabled={translation.isPending} onPress={() => void translation.mutateAsync({ contentType: 'plan_title', contentId: data.id }).then((result) => setTranslatedTitle(result.translatedText)).catch(() => undefined)}><ThemedText type="linkPrimary">Translate title{translation.targetLanguage ? ` · ${translation.targetLanguage.toUpperCase()}` : ''}</ThemedText></Pressable><ThemedText themeColor="textSecondary">{formatPlanDateTime(data.starts_at)}</ThemedText></View>
          <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">Meeting place</ThemedText><ThemedText>{data.venue.name ?? 'Public meeting place'}</ThemedText>{data.venue.address && <ThemedText type="small" themeColor="textSecondary">{data.venue.address}</ThemedText>}<ThemedText type="small" themeColor="textSecondary">Public-place meetup recommended</ThemedText></ThemedView>
          {data.note && <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">About this plan</ThemedText><ThemedText>{translatedNote ?? data.note}</ThemedText>{translatedNote && <ThemedText type="small" themeColor="textSecondary">Original: {data.note}</ThemedText>}<Pressable disabled={translation.isPending} onPress={() => void translation.mutateAsync({ contentType: 'plan_note', contentId: data.id }).then((result) => setTranslatedNote(result.translatedText)).catch(() => undefined)}><ThemedText type="linkPrimary">Translate note</ThemedText></Pressable></ThemedView>}
          {(translation.error || translation.languageError) && <ThemedText type="small" style={styles.error}>{translation.error?.message ?? translation.languageError?.message}</ThemedText>}
          {data.is_joined && <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">Meet check-in</ThemedText>{checkInStatus.isLoading ? <ActivityIndicator /> : <><ThemedText themeColor="textSecondary">{checkInStatus.data?.checked_in_count ?? 0} people checked in</ThemedText>{checkInStatus.data?.successful_meet && <ThemedText style={styles.success}>Successful Meet confirmed</ThemedText>}{checkInStatus.data?.self_checked_in ? <ThemedText style={styles.success}>You&apos;re checked in</ThemedText> : canCheckIn ? <Pressable disabled={checkIn.isPending} onPress={() => checkIn.mutate()} style={styles.checkInAction}>{checkIn.isPending ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.actionText}>I&apos;m here · Check in</ThemedText>}</Pressable> : <ThemedText type="small" themeColor="textSecondary">Check-in opens 30 minutes before the plan and requests your location only for that check.</ThemedText>}</>}{(checkIn.error || checkInStatus.error) && <ThemedText type="small" style={styles.error}>{userFacingError(checkIn.error ?? checkInStatus.error, 'Check-in is unavailable right now. Please try again later.')}</ThemedText>}</ThemedView>}
          <View style={styles.section}><ThemedText type="smallBold">People · {data.joined_count}/{data.max_participants}</ThemedText><ThemedView style={styles.members}>{data.members.map((member) => { const own = member.id === viewerId; const name = member.display_name ?? (own ? 'You' : 'HAO member'); const card = <ThemedView type="backgroundElement" style={styles.member}><View style={styles.avatar}><ThemedText type="smallBold">{name.slice(0, 1).toUpperCase()}</ThemedText></View><View style={styles.memberCopy}><ThemedText type="smallBold">{name}{member.phone_verified ? ' · ✓' : ''}</ThemedText><ThemedText type="small" themeColor="textSecondary">{own ? 'You · ' : ''}{member.role === 'creator' ? 'Host' : 'Joined'}{!own ? ' · Safety options' : ''}</ThemedText><ThemedText type="small" themeColor="textSecondary">{member.common_interests ?? 0} shared interests · {member.successful_meets ?? 0} Successful Meets</ThemedText></View></ThemedView>; return own ? <View key={member.id}>{card}</View> : <Pressable key={member.id} onPress={() => router.push({ pathname: '/safety/report', params: { targetType: 'user', targetId: member.id, targetName: name } })}>{card}</Pressable>; })}</ThemedView></View>
          {mutation.error && <ThemedText type="small" style={styles.error}>{userFacingError(mutation.error, 'The membership change could not be saved.')}</ThemedText>}
          {cancel.error && <ThemedText type="small" style={styles.error}>{userFacingError(cancel.error, 'The plan could not be cancelled.')}</ThemedText>}
          {data.is_joined && <Pressable accessibilityRole="button" onPress={() => router.push(`/chats/${data.id}`)} style={styles.chatAction}><ThemedText style={styles.actionText}>Open group chat</ThemedText></Pressable>}
          <Pressable accessibilityRole="button" disabled={actionDisabled} onPress={() => mutation.mutate()} style={[styles.action, data.is_joined && !data.is_creator && styles.secondaryAction, actionDisabled && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>}</Pressable>
          {data.is_creator && data.status !== 'cancelled' && data.status !== 'completed' && <Pressable accessibilityRole="button" disabled={cancel.isPending} onPress={() => Alert.alert('Cancel this plan?', 'Everyone in the plan will see that it was cancelled. This cannot be undone.', [{ text: 'Keep plan', style: 'cancel' }, { text: 'Cancel plan', style: 'destructive', onPress: () => cancel.mutate() }])} style={[styles.cancelAction, cancel.isPending && styles.disabled]}>{cancel.isPending ? <ActivityIndicator color="#B42318" /> : <ThemedText style={styles.cancelText}>Cancel plan</ThemedText>}</Pressable>}
          {!data.is_joined && <ThemedText type="small" themeColor="textSecondary">Joining gives you access to this plan&apos;s group chat.</ThemedText>}
          <Pressable onPress={() => router.push({ pathname: '/safety/report', params: { targetType: 'plan', targetId: data.id, targetName: data.title } })} style={styles.reportPlan}><ThemedText type="small" style={styles.reportText}>Report this plan</ThemedText></Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' }, safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 },
  content: { padding: Spacing.four, paddingBottom: 80, gap: Spacing.four }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  header: { gap: Spacing.two }, category: { color: '#E9660B', textTransform: 'capitalize' }, card: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two },
  section: { gap: Spacing.two }, members: { gap: Spacing.two }, member: { minHeight: 70, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.three }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF0E5', alignItems: 'center', justifyContent: 'center' }, memberCopy: { flex: 1, gap: 2 },
  action: { minHeight: 54, borderRadius: 27, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' }, secondaryAction: { backgroundColor: '#667085' },
  chatAction: { minHeight: 54, borderRadius: 27, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center' },
  checkInAction: { minHeight: 50, borderRadius: 25, backgroundColor: '#1F7A4D', alignItems: 'center', justifyContent: 'center' }, success: { color: '#147A48', fontWeight: '700' },
  actionText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, error: { color: '#B42318' },
  cancelAction: { minHeight: 48, borderWidth: 1, borderColor: '#B42318', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#B42318', fontWeight: '700' },
  reportPlan: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, reportText: { color: '#B42318' },
});
