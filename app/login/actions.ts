'use server';

import { createClient } from '../../lib/supabase/server';
import { createClient as createAdminClient } from '../../lib/supabase/admin';
import { getCompany } from '../../lib/company';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { checkLoginThrottle, recordLoginFailure, clearLoginFailures } from '../../lib/login-throttle';
import { clientIpFrom, normalizeLoginKey, throttleMessage } from '../../lib/login-throttle-rules';
import { isDriverRole, roleLabel } from '../../lib/roles';

export type LoginState = { error?: string } | null;

/**
 * Ошибка «колонки нет» (42703 / PGRST204) — миграция с новой колонкой
 * ещё не применена.
 */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const message = String(error.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('does not exist')
  );
}

/**
 * Строка профиля, как её видит приложение.
 *
 * manager_id может отсутствовать в БД (миграция 012 ещё не применена),
 * поэтому вводим единый тип для обоих вариантов чтения.
 */
type ProfileRow = {
  role: string | null;
  driver_id: string | null;
  manager_id: string | null;
  full_name: string | null;
};

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const rawLogin = formData.get('login');
  const rawPassword = formData.get('password');

  const loginValue = typeof rawLogin === 'string' ? rawLogin.trim() : '';
  const passwordValue = typeof rawPassword === 'string' ? rawPassword : '';

  if (!loginValue || !passwordValue) {
    return { error: 'Введите логин и пароль' };
  }

  let realEmail = loginValue;
  const supabase = await createClient();

  if (!loginValue.includes('@')) {
    // Ищем e-mail по логину через security-definer функцию.
    //
    // Функция отдаёт e-mail по фамилии/имени, поэтому с миграции 016
    // вызывать её может только service_role. Зовём через admin-клиент
    // на сервере: браузер и anon-ключ до неё не добираются.
    const admin = await createAdminClient();
    const { data: foundEmail, error: lookupError } = await admin.rpc(
      'lookup_login_email',
      { p_login: loginValue }
    );

    if (lookupError) {
      console.error('[login] lookup_login_email failed:', lookupError.message);
    }

    if (foundEmail) {
      realEmail = foundEmail as string;
    } else {
      // Старые логины без e-mail: «логин@домен» (у RAIBUILDING — raibuilding.local).
      const { legacyLoginDomain } = await getCompany();
      realEmail = legacyLoginDomain ? `${loginValue}@${legacyLoginDomain}` : loginValue;
    }
  }

  // Ограничение подбора пароля (lib/login-throttle.ts). Ключ — итоговый
  // e-mail: фамилия и e-mail одного человека считаются вместе.
  const loginKey = normalizeLoginKey(realEmail);
  const ip = clientIpFrom(await headers());
  const throttle = await checkLoginThrottle(loginKey, ip);
  if (throttle.blocked) {
    return { error: throttleMessage(throttle.retryAfterSec) };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: realEmail,
    password: passwordValue,
  });

  if (error) {
    console.error('[login] error:', error.message);
    await recordLoginFailure(loginKey, ip);
    return { error: 'Неверный логин или пароль' };
  }

  await clearLoginFailures(loginKey);

  // Получаем роль, driver_id и manager_id из profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, driver_id, manager_id, full_name')
    .eq('id', data.user.id)
    .single();

  // Миграция 012 ещё не применена — колонки profiles.manager_id нет,
  // запрос падает с 42703, профиль приходит null, роль становится
  // 'driver', и пользователь уходит в цикл редиректов
  // (/ -> /driver -> /login -> /). Читаем профиль без manager_id.
  let resolvedProfile: ProfileRow | null = profile;
  if (!resolvedProfile && profileError && isMissingColumn(profileError)) {
    const { data: baseProfile } = await supabase
      .from('profiles')
      .select('role, driver_id, full_name')
      .eq('id', data.user.id)
      .single();
    // Fallback-профиль читается без manager_id (колонки ещё нет в БД),
    // поэтому приводим его к общему типу: manager_id остаётся null.
    resolvedProfile = baseProfile
      ? { ...baseProfile, manager_id: null }
      : null;
  }

  // Роль берём только из profiles и только из известного набора.
  // Раньше здесь был fallback на 'admin' — это значило, что пользователь
  // без профиля получал админскую роль и админские куки.
  // Фаза 39: 'manager' — теперь отдельная роль менеджера по логистике,
  // а не синоним офиса. 'office' добавляем в список явно: офисные
  // профили после миграции 012 имеют role='office'.
  const KNOWN_ROLES = ['admin', 'office', 'manager', 'driver'];
  const rawRole = String(resolvedProfile?.role || '').trim().toLowerCase();
  const role = KNOWN_ROLES.includes(rawRole) ? rawRole : 'driver';
  const driverId = resolvedProfile?.driver_id || '';
  const managerId = resolvedProfile?.manager_id || '';
  const userName =
    resolvedProfile?.full_name ||
    roleLabel(role);

  // Куки роли и driver_id — быстрый путь для UI и старых страниц,
  // которые читают роль из куки. Источник правды — profiles
  // (см. lib/session.ts), поэтому значения берём именно оттуда.
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

  cookieStore.set('user_name', encodeURIComponent(userName), {
    path: '/',
    secure: isProd,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });

  cookieStore.set('role', role, {
    path: '/',
    secure: isProd,
    sameSite: 'lax',
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
  });

  if (driverId) {
    cookieStore.set('driver_id', driverId, {
      path: '/',
      secure: isProd,
      sameSite: 'lax',
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  if (managerId) {
    cookieStore.set('manager_id', managerId, {
      path: '/',
      secure: isProd,
      sameSite: 'lax',
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  if (isDriverRole(role)) {
    redirect('/driver');
  } else {
    redirect('/');
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  const cookieStore = await cookies();
  cookieStore.delete('user_name');
  cookieStore.delete('role');
  cookieStore.delete('driver_id');
  cookieStore.delete('manager_id');

  redirect('/login');
}
