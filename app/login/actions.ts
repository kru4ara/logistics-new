'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createClient } from '../../lib/supabase-server';

const FAIL_DELAY_MS = 500;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
    await delay(FAIL_DELAY_MS);
    return { error: 'Введите логин и пароль' };
  }

  const supabase = await createClient();
  const cookieStore = cookies();
  const isProd = process.env.NODE_ENV === 'production';

  // -----------------------------------------------------------------
  // 1. Офис (таблица users)
  // -----------------------------------------------------------------
  const { data: admin } = await supabase
    .from('users')
    .select('id, login, password_hash')
    .eq('login', loginValue)
    .maybeSingle();

  if (admin?.password_hash) {
    const ok = await bcrypt.compare(passwordValue, admin.password_hash);
    if (ok) {
      cookieStore.set('role', 'admin', {
        path: '/',
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
      });
      cookieStore.set('user_name', encodeURIComponent('Офис'), {
        path: '/',
        secure: isProd,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
      });
      redirect('/');
    }
  }

  // -----------------------------------------------------------------
  // 2. Водитель (таблица drivers, логин = фамилия, регистр не важен)
  // -----------------------------------------------------------------
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, password_hash')
    .ilike('last_name', loginValue)
    .maybeSingle();

  if (driver?.password_hash) {
    const ok = await bcrypt.compare(passwordValue, driver.password_hash);
    if (ok) {
      cookieStore.set('role', 'driver', {
        path: '/',
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
      });
      cookieStore.set('driver_id', driver.id, {
        path: '/',
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
      });
      cookieStore.set(
        'user_name',
        encodeURIComponent(`${driver.first_name} ${driver.last_name}`),
        {
          path: '/',
          secure: isProd,
          sameSite: 'lax',
          maxAge: COOKIE_MAX_AGE,
        }
      );
      redirect('/driver');
    }
  }

  await delay(FAIL_DELAY_MS);
  return { error: 'Неверный логин или пароль' };
}

export async function logout() {
  const cookieStore = cookies();
  cookieStore.delete('role');
  cookieStore.delete('driver_id');
  cookieStore.delete('user_name');
  redirect('/login');
}
