import i18n from '@/lib/i18n';

const localeByLanguage: Record<string, string> = { en: 'en-GB', it: 'it-IT', zh: 'zh-CN' };

function activeLocale() {
  return localeByLanguage[i18n.resolvedLanguage ?? i18n.language] ?? 'en-GB';
}

export function formatPlanTime(value: string | Date) {
  return new Date(value).toLocaleTimeString(activeLocale(), { hour: '2-digit', minute: '2-digit' });
}

export function formatPlanDateTime(value: string | Date) {
  return new Date(value).toLocaleString(activeLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
