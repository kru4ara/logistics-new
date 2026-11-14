/**
 * Форматирование под язык — без словарей, через Intl. Без 'server-only'.
 */
import { INTL_LOCALE, type Locale } from './config';

function capitalize(s: string): string {
  return s ? s[0].toLocaleUpperCase() + s.slice(1) : s;
}

/** Названия месяцев в именительном падеже, с заглавной: «Январь», «Styczeń», «January», «Січень». */
export function monthNames(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: 'long', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => capitalize(fmt.format(new Date(Date.UTC(2026, i, 15)))));
}

/**
 * Категория множественного числа (CLDR): ru/uk/pl — one / few / many,
 * en — one / other. 1 рейс · 2 рейса · 5 рейсов; 1 kurs · 2 kursy · 5 kursów.
 */
export function pluralCategory(locale: Locale, n: number): 'one' | 'few' | 'many' | 'other' {
  const c = new Intl.PluralRules(INTL_LOCALE[locale]).select(n);
  return c === 'one' || c === 'few' || c === 'many' ? c : 'other';
}

/** Дата по-местному: 14.11.2026 (ru/pl/uk), 14/11/2026 (en). Пусто — «—». */
export function formatDate(d: string | null | undefined, locale: Locale): string {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString(INTL_LOCALE[locale]);
}

/** Дата и время по-местному. Пусто — «—». */
export function formatDateTime(d: string | null | undefined, locale: Locale): string {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleString(INTL_LOCALE[locale]);
}
