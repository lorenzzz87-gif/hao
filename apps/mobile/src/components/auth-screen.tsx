import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BrandMark } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { signInWithSocialProvider, socialAuthAvailability, type SocialProvider } from '@/lib/social-auth';
import { useSessionStore } from '@/stores/session-store';
import { userFacingError } from '@/lib/user-facing-error';

const demoModeEnabled = process.env.EXPO_PUBLIC_DEMO_MODE_ENABLED === 'true';

export function AuthScreen() {
  const { t } = useTranslation();
  const setDemoMode = useSessionStore((state) => state.setDemoMode);
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setMessage(null);
    const { error } = method === 'email'
      ? await supabase.auth.signInWithOtp({ email: email.trim() })
      : await supabase.auth.signInWithOtp({ phone: phone.trim() });
    setBusy(false);
    if (error) setMessage(userFacingError(error, t('auth.sendError')));
    else {
      setCodeSent(true);
      setMessage(method === 'email' ? t('auth.emailSent') : t('auth.phoneSent'));
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage(null);
    const { error } = method === 'email'
      ? await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
      : await supabase.auth.verifyOtp({ phone: phone.trim(), token: token.trim(), type: 'sms' });
    setBusy(false);
    if (error) setMessage(userFacingError(error, t('auth.verifyError')));
  }

  async function socialSignIn(provider: SocialProvider) {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithSocialProvider(provider);
    } catch (error) {
      setMessage(userFacingError(error, t('auth.socialError')));
    } finally {
      setBusy(false);
    }
  }

  async function enterDemoMode() {
    await AsyncStorage.setItem('now-demo-mode', 'enabled');
    setDemoMode(true);
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
       <View style={styles.content}>
        <View style={styles.hero}><BrandMark width={126} /><ThemedText style={styles.tagline}>{t('auth.tagline')}</ThemedText><ThemedText themeColor="textSecondary">{t('auth.subtitle')}</ThemedText></View>
        {demoModeEnabled && <ThemedView type="backgroundElement" style={styles.demoCard}>
          <View style={styles.demoBadge}><ThemedText type="smallBold" style={styles.demoBadgeText}>{t('auth.testPreview')}</ThemedText></View>
          <View style={styles.demoCopy}><ThemedText style={styles.demoTitle}>{t('auth.demoTitle')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('auth.demoBody')}</ThemedText></View>
          <Pressable accessibilityRole="button" onPress={() => void enterDemoMode()} style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}><ThemedText style={styles.demoButtonText}>{t('auth.enterTest')}</ThemedText></Pressable>
        </ThemedView>}
        <View style={styles.loginLabel}><View style={styles.dividerLine} /><ThemedText type="small" themeColor="textSecondary">{t('auth.accountSignIn')}</ThemedText><View style={styles.dividerLine} /></View>
        <View style={styles.socialGroup}>
          {Platform.OS !== 'android' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void socialSignIn('apple')} style={({ pressed }) => [styles.socialButton, styles.appleButton, pressed && styles.pressed, busy && styles.disabled]}><ThemedText style={styles.appleText}>{t('auth.continueApple')}{socialAuthAvailability.apple ? '' : t('auth.setupRequired')}</ThemedText></Pressable>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void socialSignIn('google')} style={({ pressed }) => [styles.socialButton, pressed && styles.pressed, busy && styles.disabled]}><ThemedText>{t('auth.continueGoogle')}{socialAuthAvailability.google ? '' : t('auth.setupRequired')}</ThemedText></Pressable>
        </View>
        <View style={styles.methodPicker}><Pressable accessibilityRole="button" onPress={() => { setMethod('email'); setCodeSent(false); setToken(''); setMessage(null); }} style={[styles.methodChoice, method === 'email' && styles.methodSelected]}><ThemedText type="smallBold">{t('auth.email')}</ThemedText></Pressable><Pressable accessibilityRole="button" onPress={() => { setMethod('phone'); setCodeSent(false); setToken(''); setMessage(null); }} style={[styles.methodChoice, method === 'phone' && styles.methodSelected]}><ThemedText type="smallBold">{t('auth.phone')}</ThemedText></Pressable></View>
        <ThemedText themeColor="textSecondary">{method === 'email' ? t('auth.emailHelp') : t('auth.phoneHelp')}</ThemedText>
        {method === 'email' ? <TextInput accessibilityLabel={t('auth.emailAddress')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" value={email} onChangeText={setEmail} editable={!codeSent && !busy} style={styles.input} /> : <TextInput accessibilityLabel={t('auth.phoneNumber')} autoComplete="tel" keyboardType="phone-pad" placeholder="+39 333 123 4567" value={phone} onChangeText={setPhone} editable={!codeSent && !busy} style={styles.input} />}
        {codeSent && <TextInput accessibilityLabel={t('auth.verificationCode')} autoComplete="one-time-code" keyboardType="number-pad" placeholder={t('auth.codePlaceholder')} value={token} onChangeText={setToken} editable={!busy} style={styles.input} />}
        {message && <ThemedText type="small" themeColor="textSecondary">{message}</ThemedText>}
        <Pressable accessibilityRole="button" disabled={busy || !(method === 'email' ? email.trim() : phone.trim()) || (codeSent && token.trim().length < 6)} onPress={codeSent ? verifyCode : sendCode} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.buttonText}>{codeSent ? t('auth.verifyContinue') : t('auth.sendCode')}</ThemedText>}
        </Pressable>
        {codeSent && <Pressable onPress={() => { setCodeSent(false); setToken(''); setMessage(null); }}><ThemedText type="small">{method === 'email' ? t('auth.differentEmail') : t('auth.differentNumber')}</ThemedText></Pressable>}
        <ThemedText type="small" style={styles.legal} themeColor="textSecondary">{t('auth.ageRequirement')}</ThemedText>
       </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  safeArea: { width: '100%', maxWidth: MaxContentWidth, flex: 1 },
  content: { width: '100%', padding: Spacing.four, gap: Spacing.three, paddingVertical: Spacing.five },
  hero: { gap: Spacing.two, marginBottom: Spacing.two },
  tagline: { fontSize: 31, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  demoCard: { borderRadius: 24, padding: Spacing.four, gap: Spacing.three, borderWidth: 1, borderColor: Brand.border },
  demoBadge: { alignSelf: 'flex-start', backgroundColor: Brand.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  demoBadgeText: { color: Brand.primary, fontSize: 11, letterSpacing: 0.6 },
  demoTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800' },
  demoCopy: { gap: Spacing.one },
  demoButton: { minHeight: 54, borderRadius: 27, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  demoButtonText: { color: '#FFFFFF', fontWeight: '700' },
  socialGroup: { gap: Spacing.two },
  socialButton: { minHeight: 52, borderWidth: 1, borderColor: '#C9CBD1', borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  appleButton: { backgroundColor: '#111111', borderColor: '#111111' }, appleText: { color: '#FFFFFF', fontWeight: '700' },
  loginLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one }, dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#D5D2CF' },
  methodPicker: { flexDirection: 'row', borderRadius: 24, padding: 3, backgroundColor: '#ECEEF2' }, methodChoice: { flex: 1, minHeight: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, methodSelected: { backgroundColor: '#FFFFFF' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#C9CBD1', borderRadius: 14, paddingHorizontal: Spacing.three, backgroundColor: '#FFFFFF', color: '#111111', fontSize: 16 },
  button: { minHeight: 54, borderRadius: 27, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  legal: { textAlign: 'center', paddingBottom: Spacing.three },
});
