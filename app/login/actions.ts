'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export async function login(formData: FormData) {
  const login = formData.get('login') as string;
  const password = formData.get('password') as string;

  // Проверяем офис (используем maybeSingle, чтобы не падать при ошибке)
  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('*')
    .eq('login', login)
    .eq('password', password)
    .maybeSingle();

  if (adminError) {
    console.error('Ошибка при проверке офиса:', adminError.message);
  }

  if (admin) {
    cookies().set('role', 'admin', { path: '/' });
    redirect('/');
  }

  // Проверяем водителя
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('last_name', login)
    .eq('password', password)
    .maybeSingle();

  if (driverError) {
    console.error('Ошибка при проверке водителя:', driverError.message);
  }

  if (driver) {
    cookies().set('role', 'driver', { path: '/' });
    cookies().set('driver_id', driver.id, { path: '/' });
    redirect('/driver');
  }

  // Если ничего не совпало
  redirect('/login?error=1');
}
