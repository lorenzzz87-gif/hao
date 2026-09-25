import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import React from 'react';
import '@/lib/i18n';
import Head from 'expo-router/head';

import { AppGate } from '@/components/app-gate';
import { AppProvider } from '@/providers/app-provider';

export default function TabLayout() {
  const [iconsLoaded, iconError] = useFonts(Ionicons.font);

  if (!iconsLoaded && !iconError) return null;
  return (
    <ThemeProvider value={DefaultTheme}>
      <Head>
        <title>HAO — Meet people. Do something. Now.</title>
        <meta name="description" content="Discover spontaneous public plans nearby and meet people safely with HAO." />
        <meta property="og:title" content="HAO — Meet people. Do something. Now." />
        <meta property="og:description" content="Discover spontaneous public plans nearby for the next six hours." />
      </Head>
      <AppProvider><AppGate /></AppProvider>
    </ThemeProvider>
  );
}
