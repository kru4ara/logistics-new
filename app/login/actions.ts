'use server';

import { createClient } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export type LoginState = { error?: string } | null;

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
    // Ищем в таблице users (офис)
    const adminRes = await supabase
      .from('users')
      .select('email')
      .eq('login', loginValue)
      .maybeSingle();

    if (adminRes.data?.email) {
      realEmail = adminRes.data.email;
    } else {
      // Ищем в таблице drivers (по фамилии)
      const driverRes = await supabase
        .from('drivers')
        .select('email')
        .ilike('last_name', loginValue)
        .maybeSingle();

      if (driverRes.data?.email) {
        realEmail = driverRes.data.email;
      } else {
        realEmail = `${loginValue}@raibuilding.local`;
      }
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

  // Получаем роль и driver_id из profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, driver_id, full_name')
    .eq('id', data.user.id)
    .single();

  const role = profile?.role || 'admin';
  const driverId = profile?.driver_id || '';
  const userName = profile?.full_name || (role === 'admin' ? 'Офис' : 'Водитель');

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
