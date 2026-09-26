import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import type { PreferredAge } from '@/types/age-band';

type Props = {
  visible: boolean;
  preferredAge: PreferredAge;
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AgePreferenceSheet({ visible, preferredAge, busy, error, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel={t('joinAgePrompt.cancel')} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <ThemedView style={styles.sheet}>
          <View style={styles.handle} />
          <ThemedText type="subtitle">{t('joinAgePrompt.title')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('joinAgePrompt.body', { range: t(`age.pref.${preferredAge}`) })}</ThemedText>
          {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryText}>{t('joinAgePrompt.confirm')}</ThemedText>}</Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.secondary}><ThemedText type="linkPrimary">{t('joinAgePrompt.cancel')}</ThemedText></Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10, 24, 43, 0.36)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.four, paddingBottom: 36, gap: Spacing.three, borderWidth: 1, borderColor: Brand.border },
  handle: { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: Brand.border },
  primary: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primary },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  error: { color: '#B42318' },
});
