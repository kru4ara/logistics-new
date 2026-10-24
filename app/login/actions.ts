'use server';

import { createClient } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';

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

  // Если ввели email — используем его напрямую
  let email = loginValue;
  let realEmail = loginValue;

  if (!loginValue.includes('@')) {
    // Ищем в таблице users (офис)
    const adminRes = await createClient()
      .from('users')
      .select('email')
      .eq('login', loginValue)
      .maybeSingle();

    if (adminRes.data?.email) {
      realEmail = adminRes.data.email;
    } else {
      // Ищем в таблице drivers (по фамилии)
      const driverRes = await createClient()
        .from('drivers')
        .select('email')
        .ilike('last_name', loginValue)
        .maybeSingle();

      if (driverRes.data?.email) {
        realEmail = driverRes.data.email;
      } else {
        // Если не нашли — пробуем как есть (с добавлением @raibuilding.local)
        realEmail = `${loginValue}@raibuilding.local`;
      }
    }
  }

  email = realEmail;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: passwordValue,
  });

  if (error) {
    console.error('[login] error:', error.message);
    return { error: 'Неверный логин или пароль' };
  }

  // Получаем роль из profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  // Если профиля нет — считаем админом (чтобы не залочиться)
  const role = profile?.role || 'admin';

  if (role === 'driver') {
    redirect('/driver');
  } else {
    redirect('/');
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
