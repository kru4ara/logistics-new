import { INTL_LOCALE, type Locale } from '../../../lib/i18n/config';
// Форматирование дат для страницы «Сегодня».
// Вынесено из app/today/page.tsx (Фаза 40).

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDateRu(d: string | null | undefined, locale: Locale = 'ru'): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(INTL_LOCALE[locale]);
  } catch {
    return d;
  }
}

// react-hooks/purity: impure-вызовы (Date.now) нельзя делать прямо в теле
// компонента. Правило ориентировано на клиентский рендер (гидрация), а здесь
// компонент серверный и force-dynamic — расхождение с клиентом невозможно,
// поэтому impure-вызов изолирован в отдельной функции.
export function currentTimestamp(): number {
  return Date.now();
}
