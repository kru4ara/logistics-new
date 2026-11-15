// Портал клиента — чистые правила (тесты): токен, язык, статус заказа для клиента.
import { LOCALES, type Locale } from './i18n/config';

/** Токен ссылки: 32 случайных байта в base64url — 43 символа. */
export const isTokenFormat = (t: string | null | undefined) => /^[A-Za-z0-9_-]{43}$/.test(t ?? '');

/**
 * Язык портала: ?lang=…, иначе первый подходящий из Accept-Language, иначе английский
 * (клиенты — из разных стран).
 */
export function portalLocale(langParam: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  const ok = (v: string) => (LOCALES as readonly string[]).includes(v);
  if (langParam && ok(langParam)) return langParam as Locale;
  const prefs = (acceptLanguage ?? '')
    .split(',')
    .map((p) => {
      const [tag, q] = p.trim().split(';q=');
      return { lang: tag.toLowerCase().slice(0, 2), q: q ? Number(q) : 1 };
    })
    .filter((p) => p.lang && Number.isFinite(p.q))
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) {
    if (ok(p.lang)) return p.lang as Locale;
    if (p.lang === 'be') return 'ru'; // белорусский — ближайший из доступных
  }
  return 'en';
}

export type PublicStatus = 'planned' | 'inTransit' | 'delivered' | 'invoiced' | 'paid';

/** Внутренний статус рейса → что видит клиент. Отменённые и неизвестные — не показываем. */
export function publicStatus(status: string | null | undefined): PublicStatus | null {
  switch (status) {
    case 'planned':
      return 'planned';
    case 'active':
      return 'inTransit';
    case 'completed':
      return 'delivered';
    case 'invoiced':
      return 'invoiced';
    case 'paid':
      return 'paid';
    default:
      return null;
  }
}

/** Ссылка на карту по координатам (без названий мест — геокодинга нет). */
export const mapLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lng.toFixed(5)}`;
