import Ionicons from '@expo/vector-icons/Ionicons';
import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import React, { type ComponentProps, type PropsWithChildren } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

export default function AppTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <View style={styles.app}>
      <Slot />
      <CustomTabList>
        <TabButton href="/" icon="home-outline" isFocused={pathname === '/'}>{t('now')}</TabButton>
        <TabButton href="/explore" icon="map-outline" isFocused={pathname === '/explore'}>{t('map')}</TabButton>
        <TabButton href="/create" icon="add" isFocused={pathname === '/create'} prominent>{t('create')}</TabButton>
        <TabButton href="/chats" icon="chatbubble-outline" isFocused={pathname.startsWith('/chats')}>{t('chats')}</TabButton>
        <TabButton href="/me" icon="person-outline" isFocused={pathname === '/me'}>{t('me')}</TabButton>
      </CustomTabList>
    </View>
  );
}

type TabButtonProps = PropsWithChildren<{
  href: Href;
  icon: ComponentProps<typeof Ionicons>['name'];
  isFocused: boolean;
  prominent?: boolean;
}>;

export function TabButton({ children, href, isFocused, icon, prominent }: TabButtonProps) {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.navigate(href)} accessibilityRole="tab" accessibilityLabel={prominent ? 'Create a plan' : String(children)} accessibilityState={{ selected: isFocused }} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, prominent && styles.prominentIcon, isFocused && !prominent && styles.activeIcon]}>
        <Ionicons name={icon} size={prominent ? 28 : 23} color={prominent || isFocused ? Brand.primary : Brand.slate} />
      </View>
      {!prominent && <ThemedText type="small" style={[styles.tabLabel, isFocused && styles.activeLabel]}>{children}</ThemedText>}
    </Pressable>
  );
}

export function CustomTabList({ children }: PropsWithChildren) {
  return (
    <View style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    width: '100%',
    minHeight: 72,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    maxWidth: MaxContentWidth,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Brand.border,
    boxShadow: '0 -4px 24px rgba(16, 24, 39, 0.08)',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: { flex: 1, minWidth: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { width: 38, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: Brand.primarySoft },
  prominentIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF0E5', marginTop: -20, borderWidth: 1, borderColor: '#FFD3B0' },
  tabLabel: { fontSize: 11, lineHeight: 15, color: Brand.slate },
  activeLabel: { color: Brand.primary, fontWeight: '800' },
});
