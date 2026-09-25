import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { signInWithSocialProvider, socialAuthAvailability, type SocialProvider } from '@/lib/social-auth';
import { useSessionStore } from '@/stores/session-store';

const demoModeEnabled = process.env.EXPO_PUBLIC_DEMO_MODE_ENABLED === 'true';

export function AuthScreen() {
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
    if (error) setMessage(error.message);
    else {
      setCodeSent(true);
      setMessage(method === 'email' ? 'Check your email for the sign-in code or link.' : 'Verification code sent.');
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage(null);
    const { error } = method === 'email'
      ? await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
      : await supabase.auth.verifyOtp({ phone: phone.trim(), token: token.trim(), type: 'sms' });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  async function socialSignIn(provider: SocialProvider) {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithSocialProvider(provider);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in could not be completed.');
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
        <View style={styles.hero}><BrandMark width={126} /><ThemedText style={styles.tagline}>Meet people.{"\n"}Do something. Now.</ThemedText><ThemedText themeColor="textSecondary">Spontaneous plans nearby. No endless feed, just a reason to step outside.</ThemedText></View>
        {demoModeEnabled && <ThemedView type="backgroundElement" style={styles.demoCard}>
          <View style={styles.demoBadge}><ThemedText type="smallBold" style={styles.demoBadgeText}>TEST PREVIEW</ThemedText></View>
          <View style={styles.demoCopy}><ThemedText style={styles.demoTitle}>See what&apos;s happening nearby</ThemedText><ThemedText type="small" themeColor="textSecondary">No account needed. Explore HAO safely in test mode.</ThemedText></View>
          <Pressable accessibilityRole="button" onPress={() => void enterDemoMode()} style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}><ThemedText style={styles.demoButtonText}>Enter test mode</ThemedText></Pressable>
        </ThemedView>}
        <View style={styles.loginLabel}><View style={styles.dividerLine} /><ThemedText type="small" themeColor="textSecondary">Account sign in</ThemedText><View style={styles.dividerLine} /></View>
        <View style={styles.socialGroup}>
          {Platform.OS !== 'android' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void socialSignIn('apple')} style={({ pressed }) => [styles.socialButton, styles.appleButton, pressed && styles.pressed, busy && styles.disabled]}><ThemedText style={styles.appleText}>Continue with Apple{socialAuthAvailability.apple ? '' : ' · Setup required'}</ThemedText></Pressable>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void socialSignIn('google')} style={({ pressed }) => [styles.socialButton, pressed && styles.pressed, busy && styles.disabled]}><ThemedText>Continue with Google{socialAuthAvailability.google ? '' : ' · Setup required'}</ThemedText></Pressable>
        </View>
        <View style={styles.methodPicker}><Pressable accessibilityRole="button" onPress={() => { setMethod('email'); setCodeSent(false); setToken(''); setMessage(null); }} style={[styles.methodChoice, method === 'email' && styles.methodSelected]}><ThemedText type="smallBold">Email</ThemedText></Pressable><Pressable accessibilityRole="button" onPress={() => { setMethod('phone'); setCodeSent(false); setToken(''); setMessage(null); }} style={[styles.methodChoice, method === 'phone' && styles.methodSelected]}><ThemedText type="smallBold">Phone</ThemedText></Pressable></View>
        <ThemedText themeColor="textSecondary">{method === 'email' ? 'Use your email for this web test.' : 'Enter your phone number with country code.'}</ThemedText>
        {method === 'email' ? <TextInput accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" value={email} onChangeText={setEmail} editable={!codeSent && !busy} style={styles.input} /> : <TextInput accessibilityLabel="Phone number" autoComplete="tel" keyboardType="phone-pad" placeholder="+39 333 123 4567" value={phone} onChangeText={setPhone} editable={!codeSent && !busy} style={styles.input} />}
        {codeSent && <TextInput accessibilityLabel="Verification code" autoComplete="one-time-code" keyboardType="number-pad" placeholder="6-digit code" value={token} onChangeText={setToken} editable={!busy} style={styles.input} />}
        {message && <ThemedText type="small" themeColor="textSecondary">{message}</ThemedText>}
        <Pressable accessibilityRole="button" disabled={busy || !(method === 'email' ? email.trim() : phone.trim()) || (codeSent && token.trim().length < 6)} onPress={codeSent ? verifyCode : sendCode} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.buttonText}>{codeSent ? 'Verify and continue' : 'Send code'}</ThemedText>}
        </Pressable>
        {codeSent && <Pressable onPress={() => { setCodeSent(false); setToken(''); setMessage(null); }}><ThemedText type="small">Use a different {method === 'email' ? 'email' : 'number'}</ThemedText></Pressable>}
        <ThemedText type="small" style={styles.legal} themeColor="textSecondary">You must be 18 or older to use HAO.</ThemedText>
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
