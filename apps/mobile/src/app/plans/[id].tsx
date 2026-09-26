import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
  if (plan.error || !plan.data) return <ThemedView style={styles.center}><ThemedText type="smallBold">{t('plan.unavailable')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{userFacingError(plan.error, t('plan.notFound'))}</ThemedText><Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">{t('plan.goBack')}</ThemedText></Pressable></ThemedView>;

  const data = plan.data;
  const joinable = data.status === 'open' || data.status === 'confirmed';
  const actionDisabled = mutation.isPending || data.is_creator || (!data.is_joined && (!joinable || data.seats_remaining === 0));
  const actionLabel = data.is_creator ? t('plan.hosting') : data.is_joined ? t('plan.leave') : data.status === 'cancelled' ? t('plan.cancelled') : data.status === 'completed' ? t('plan.completed') : data.status === 'started' ? t('plan.started') : data.status === 'full' || data.seats_remaining === 0 ? t('plan.full') : t('plan.join');
  const now = Date.now();
  const checkInOpensAt = new Date(data.starts_at).getTime() - 30 * 60_000;
  const checkInClosesAt = new Date(data.expected_end_at ?? new Date(new Date(data.starts_at).getTime() + 2 * 60 * 60_000).toISOString()).getTime() + 30 * 60_000;
  const canCheckIn = data.is_joined && now >= checkInOpensAt && now <= checkInClosesAt && !checkInStatus.data?.self_checked_in;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()}><ThemedText type="linkPrimary">{t('plan.back')}</ThemedText></Pressable>
          <View style={styles.header}><ThemedText type="smallBold" style={styles.category}>{data.activity_type}</ThemedText><ThemedText type="subtitle">{translatedTitle ?? data.title}</ThemedText>{translatedTitle && <ThemedText type="small" themeColor="textSecondary">{t('plan.original')}: {data.title}</ThemedText>}<Pressable disabled={translation.isPending} onPress={() => void translation.mutateAsync({ contentType: 'plan_title', contentId: data.id }).then((result) => setTranslatedTitle(result.translatedText)).catch(() => undefined)}><ThemedText type="linkPrimary">{t('plan.translateTitle')}{translation.targetLanguage ? ` · ${translation.targetLanguage.toUpperCase()}` : ''}</ThemedText></Pressable><ThemedText themeColor="textSecondary">{formatPlanDateTime(data.starts_at)}</ThemedText></View>
          <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{t('plan.meetingPlace')}</ThemedText><ThemedText>{data.venue.name ?? t('plan.publicPlace')}</ThemedText>{data.venue.address && !data.venue.is_approximate && <ThemedText type="small" themeColor="textSecondary">{data.venue.address}</ThemedText>}<ThemedText type="small" themeColor="textSecondary">{data.venue.is_approximate ? t('plan.approximateArea') : t('plan.publicRecommended')}</ThemedText></ThemedView>
          {data.note && <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{t('plan.about')}</ThemedText><ThemedText>{translatedNote ?? data.note}</ThemedText>{translatedNote && <ThemedText type="small" themeColor="textSecondary">{t('plan.original')}: {data.note}</ThemedText>}<Pressable disabled={translation.isPending} onPress={() => void translation.mutateAsync({ contentType: 'plan_note', contentId: data.id }).then((result) => setTranslatedNote(result.translatedText)).catch(() => undefined)}><ThemedText type="linkPrimary">{t('plan.translateNote')}</ThemedText></Pressable></ThemedView>}
          {(translation.error || translation.languageError) && <ThemedText type="small" style={styles.error}>{userFacingError(translation.error ?? translation.languageError, t('plan.translationError'))}</ThemedText>}
          {data.is_joined && <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{t('plan.checkInTitle')}</ThemedText>{checkInStatus.isLoading ? <ActivityIndicator /> : <><ThemedText themeColor="textSecondary">{t('plan.checkedInCount', { count: checkInStatus.data?.checked_in_count ?? 0 })}</ThemedText>{checkInStatus.data?.successful_meet && <ThemedText style={styles.success}>{t('plan.successConfirmed')}</ThemedText>}{checkInStatus.data?.self_checked_in ? <ThemedText style={styles.success}>{t('plan.youCheckedIn')}</ThemedText> : canCheckIn ? <Pressable disabled={checkIn.isPending} onPress={() => checkIn.mutate()} style={styles.checkInAction}>{checkIn.isPending ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.actionText}>{t('plan.checkIn')}</ThemedText>}</Pressable> : <ThemedText type="small" themeColor="textSecondary">{t('plan.checkInHelp')}</ThemedText>}</>}{(checkIn.error || checkInStatus.error) && <ThemedText type="small" style={styles.error}>{userFacingError(checkIn.error ?? checkInStatus.error, t('plan.checkInError'))}</ThemedText>}</ThemedView>}
          <View style={styles.section}><ThemedText type="smallBold">{t('plan.people')} · {data.joined_count}/{data.max_participants}</ThemedText><ThemedView style={styles.members}>{data.members.map((member) => { const own = member.id === viewerId; const name = member.display_name ?? (own ? t('plan.you') : t('plan.member')); const card = <ThemedView type="backgroundElement" style={styles.member}><View style={styles.avatar}><ThemedText type="smallBold">{name.slice(0, 1).toUpperCase()}</ThemedText></View><View style={styles.memberCopy}><ThemedText type="smallBold">{name}{member.phone_verified ? ' · ✓' : ''}</ThemedText><ThemedText type="small" themeColor="textSecondary">{own ? `${t('plan.you')} · ` : ''}{member.role === 'creator' ? t('plan.host') : t('plan.joined')}{!own ? ` · ${t('plan.safetyOptions')}` : ''}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('plan.memberStats', { interests: member.common_interests ?? 0, meets: member.successful_meets ?? 0 })}</ThemedText></View></ThemedView>; return own ? <View key={member.id}>{card}</View> : <Pressable key={member.id} onPress={() => router.push({ pathname: '/safety/report', params: { targetType: 'user', targetId: member.id, targetName: name } })}>{card}</Pressable>; })}</ThemedView></View>
          {mutation.error && <ThemedText type="small" style={styles.error}>{userFacingError(mutation.error, t('plan.membershipError'))}</ThemedText>}
          {cancel.error && <ThemedText type="small" style={styles.error}>{userFacingError(cancel.error, t('plan.cancelError'))}</ThemedText>}
          {data.is_joined && <Pressable accessibilityRole="button" onPress={() => router.push(`/chats/${data.id}`)} style={styles.chatAction}><ThemedText style={styles.actionText}>{t('plan.openChat')}</ThemedText></Pressable>}
          <Pressable accessibilityRole="button" disabled={actionDisabled} onPress={() => mutation.mutate()} style={[styles.action, data.is_joined && !data.is_creator && styles.secondaryAction, actionDisabled && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>}</Pressable>
          {data.is_creator && data.status !== 'cancelled' && data.status !== 'completed' && <Pressable accessibilityRole="button" disabled={cancel.isPending} onPress={() => Alert.alert(t('plan.cancelTitle'), t('plan.cancelBody'), [{ text: t('plan.keep'), style: 'cancel' }, { text: t('plan.cancelPlan'), style: 'destructive', onPress: () => cancel.mutate() }])} style={[styles.cancelAction, cancel.isPending && styles.disabled]}>{cancel.isPending ? <ActivityIndicator color="#B42318" /> : <ThemedText style={styles.cancelText}>{t('plan.cancelPlan')}</ThemedText>}</Pressable>}
          {!data.is_joined && <ThemedText type="small" themeColor="textSecondary">{t('plan.joinChatHelp')}</ThemedText>}
          <Pressable onPress={() => router.push({ pathname: '/safety/report', params: { targetType: 'plan', targetId: data.id, targetName: data.title } })} style={styles.reportPlan}><ThemedText type="small" style={styles.reportText}>{t('plan.report')}</ThemedText></Pressable>
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
