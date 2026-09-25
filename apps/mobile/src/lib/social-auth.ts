import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'apple' | 'google';

export const socialAuthAvailability = {
  apple: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === 'true',
  google: process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true',
};

function redirectUri() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/auth/callback`;
  return makeRedirectUri({ scheme: 'now', path: 'auth/callback' });
}

function parseCallbackParams(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  fragment.forEach((value, key) => params.set(key, value));
  return params;
}

export async function signInWithSocialProvider(provider: SocialProvider) {
  if (!socialAuthAvailability[provider]) {
    throw new Error(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in is waiting for its developer credentials.`);
  }

  const redirectTo = redirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
  });

  if (error) throw error;
  if (Platform.OS === 'web' || !data.url) return;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    throw new Error('Sign-in did not complete. Please try again.');
  }

  const params = parseCallbackParams(result.url);
  if (params.get('error')) throw new Error(params.get('error_description') ?? 'Sign-in could not be completed.');
  const code = params.get('code');
  if (code) {
    const exchange = await supabase.auth.exchangeCodeForSession(code);
    if (exchange.error) throw exchange.error;
    return;
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) throw new Error('The sign-in response did not include a session.');
  const session = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (session.error) throw session.error;
}
