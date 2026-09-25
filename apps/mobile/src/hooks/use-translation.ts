import { useMutation, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export type TranslatableContent = 'plan_title' | 'plan_note' | 'message';

export function usePrimaryLanguage() {
  const userId = useSessionStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: ['primary-language', userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async () => {
      const result = await supabase.from('profiles').select('primary_language').eq('id', userId!).single();
      if (result.error) throw result.error;
      return result.data.primary_language as 'en' | 'it' | 'zh';
    },
  });
}

export function useTranslateContent() {
  const language = usePrimaryLanguage();
  const mutation = useMutation({
    mutationFn: async ({ contentType, contentId }: { contentType: TranslatableContent; contentId: string }) => {
      if (!language.data) throw new Error('Your primary language is unavailable.');
      const result = await supabase.functions.invoke('translate-content', { body: { contentType, contentId, targetLanguage: language.data } });
      if (result.error) throw result.error;
      if (result.data?.error) throw new Error(result.data.error === 'translation_budget_reached' ? 'Translation is temporarily at its usage limit.' : 'Translation is temporarily unavailable.');
      return result.data as { translatedText: string; cached: boolean; targetLanguage: string };
    },
  });
  return { ...mutation, targetLanguage: language.data, languageError: language.error };
}
