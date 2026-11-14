import 'server-only';

import { createClient } from './supabase/admin';
import { DEFAULT_LOCALE, isLocale, type Locale } from './i18n/config';
import { createT, type T } from './i18n/translate';
import { MESSAGES } from './i18n/messages';

/**
 * Язык водителя — из его профиля (profiles.locale), который он выбирает
 * сам в меню. Нужен для сообщений, которые уходят водителю (Telegram),
 * а не для интерфейса текущего пользователя. Нет профиля — русский.
 */
export async function getDriverLocale(driverId: string | null | undefined): Promise<Locale> {
  if (!driverId) return DEFAULT_LOCALE;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('locale')
    .eq('driver_id', driverId)
    .not('locale', 'is', null)
    .limit(1)
    .maybeSingle();
  return isLocale(data?.locale) ? data.locale : DEFAULT_LOCALE;
}

/** Переводчик на языке водителя. */
export async function getDriverT(driverId: string | null | undefined): Promise<{ t: T; locale: Locale }> {
  const locale = await getDriverLocale(driverId);
  return { t: createT(MESSAGES[locale], MESSAGES[DEFAULT_LOCALE]), locale };
}
