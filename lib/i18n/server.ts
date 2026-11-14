import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from './config';
import { MESSAGES } from './messages';
import { createT, type T } from './translate';

/**
 * Язык текущего запроса: cookie `locale` (выбор пользователя; при входе
 * ставится из profiles.locale) → Accept-Language браузера → русский.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
});

/** t() для server components, route handlers и server actions. */
export async function getT(): Promise<{ t: T; locale: Locale }> {
  const locale = await getLocale();
  return { t: createT(MESSAGES[locale], MESSAGES[DEFAULT_LOCALE]), locale };
}
