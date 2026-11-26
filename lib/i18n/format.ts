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

// ---- Деньги ----
// Один формат сумм на всю CRM: «7 000 €», «1 389,50 €», «−315 €».
// Группы тысяч — всегда (польская норма не делит 4 знака, в таблицах это
// ломает выравнивание), неразрывный пробел перед знаком валюты.
const NBSP = ' ';
const groupFmt = new Map<number, Intl.NumberFormat>();
function numberFmt(digits: number): Intl.NumberFormat {
  let f = groupFmt.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: 'always',
    } as Intl.NumberFormatOptions);
    groupFmt.set(digits, f);
  }
  return f;
}

/** Число с группами тысяч: 331 424 · 1 389,50. digits 'auto' — копейки только если есть. */
export function formatNumber(n: number | string | null | undefined, digits: number | 'auto' = 0): string {
  const v = Number(n);
  if (n == null || n === '' || !Number.isFinite(v)) return '—';
  const d = digits === 'auto' ? (Math.round(v * 100) % 100 === 0 ? 0 : 2) : digits;
  // −0 не показываем; минус — типографский.
  return numberFmt(d).format(Object.is(v, -0) ? 0 : v).replace('-', '−');
}

const CURRENCY_SIGN: Record<string, string> = { EUR: '€', PLN: 'zł', USD: '$', BYN: 'BYN' };

/** Сумма с валютой: «7 000 €», «1 389,50 zł». Пусто — «—». */
export function formatMoney(
  n: number | string | null | undefined,
  digits: number | 'auto' = 0,
  currency: string | null = 'EUR',
): string {
  const num = formatNumber(n, digits);
  if (num === '—') return num;
  const code = (currency || 'EUR').toUpperCase();
  return `${num}${NBSP}${CURRENCY_SIGN[code] ?? code}`;
}

/** Сумма в евро — частный случай formatMoney. */
export const formatEur = (n: number | string | null | undefined, digits: number | 'auto' = 0): string =>
  formatMoney(n, digits, 'EUR');
