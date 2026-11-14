/**
 * Языки интерфейса. Файл без 'server-only' — нужен и клиенту.
 *
 * Язык выбирает каждый пользователь сам (офис — польский, водитель —
 * русский). Хранится в cookie `locale` и в profiles.locale (миграция 024):
 * cookie — быстрый путь на каждый запрос, профиль — чтобы язык следовал
 * за пользователем на другое устройство (cookie ставится при входе).
 *
 * Префиксов в адресах (/pl/trips) нет намеренно: CRM за логином,
 * адреса не индексируются, а префиксы сломали бы ссылки и proxy.ts.
 */
export const LOCALES = ['ru', 'pl', 'en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ru';
export const LOCALE_COOKIE = 'locale';

/** Название языка на нём самом — для переключателя. */
export const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Русский',
  pl: 'Polski',
  en: 'English',
  uk: 'Українська',
};

/** Для Intl (даты, числа). */
export const INTL_LOCALE: Record<Locale, string> = {
  ru: 'ru-RU',
  pl: 'pl-PL',
  en: 'en-GB',
  uk: 'uk-UA',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Язык из заголовка Accept-Language (до входа, когда выбора ещё нет).
 * «pl-PL,pl;q=0.9,en;q=0.8» → 'pl'. Белорусский браузер → русский.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const langs = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  for (const { lang } of langs) {
    if (isLocale(lang)) return lang;
    if (lang === 'be') return 'ru';
  }
  return null;
}
