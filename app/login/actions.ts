'use server';

import { createClient } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

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
    // Раньше здесь был прямой SELECT из users/drivers под anon-ключом.
    // Это работало только потому, что RLS на этих таблицах был
    // ВЫКЛЮЧЕН: anon-ключ публичный, лежит в клиентском бандле, и
    // читать мог кто угодно из интернета. Теперь прямой доступ закрыт
    // политиками RLS, а нужный e-mail отдаёт функция
    // lookup_login_email (миграция 20261029_002).
    const { data: foundEmail, error: lookupError } = await supabase.rpc(
      'lookup_login_email',
      { p_login: loginValue }
    );

    if (lookupError) {
      console.error('[login] lookup_login_email failed:', lookupError.message);
    }

    if (foundEmail) {
      realEmail = foundEmail as string;
    } else {
      realEmail = `${loginValue}@raibuilding.local`;
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: realEmail,
    password: passwordValue,
  });

  if (error) {
    console.error('[login] error:', error.message);
    return { error: 'Неверный логин или пароль' };
  }

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
  let resolvedProfile = profile;
  if (!resolvedProfile && profileError && isMissingColumn(profileError)) {
    const { data: baseProfile } = await supabase
      .from('profiles')
      .select('role, driver_id, full_name')
      .eq('id', data.user.id)
      .single();
    resolvedProfile = baseProfile;
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
    (role === 'driver' ? 'Водитель' : role === 'manager' ? 'Менеджер' : 'Офис');

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

  if (role === 'driver') {
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
  
  redirect('/login');
}
