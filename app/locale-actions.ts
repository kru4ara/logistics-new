'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '../lib/supabase/admin';
import { getSessionContext } from '../lib/session';
import { isLocale, LOCALE_COOKIE } from '../lib/i18n/config';

const YEAR = 60 * 60 * 24 * 365;

/**
 * Сменить язык интерфейса. Доступно и до входа (переключатель на странице
 * входа) — меняет только cookie языка; вошедшему пользователю дополнительно
 * сохраняет язык в СВОЙ профиль (id из сессии, не из запроса), чтобы он
 * следовал за ним на другие устройства.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: YEAR,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  const { userId } = await getSessionContext();
  if (userId) {
    const admin = await createClient();
    const { error } = await admin.from('profiles').update({ locale }).eq('id', userId);
    // Колонки ещё нет (миграция 024 не применена) — язык всё равно сменится через cookie.
    if (error) console.warn('[locale] profiles.locale не сохранён:', error.message);
  }

  revalidatePath('/', 'layout');
}
