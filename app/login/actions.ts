'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export async function login(formData: FormData) {
  const login = formData.get('login') as string;
  const password = formData.get('password') as string;

  // Проверяем в таблице users (офис)
  const { data: admin } = await supabase
    .from('users')
    .select('*')
    .eq('login', login)
    .eq('password', password)
    .single();

  if (admin) {
    cookies().set('role', 'admin', { path: '/' });
    redirect('/');
    return;
  }

  // Проверяем в таблице drivers (водители)
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('last_name', login) // фамилия латиницей, например kavaliou
    .eq('password', password)
    .single();

  if (driver) {
    cookies().set('role', 'driver', { path: '/' });
    cookies().set('driver_id', driver.id, { path: '/' });
    redirect('/driver');
    return;
  }

  // Если ничего не совпало, возвращаем ошибку
  redirect('/login?error=1');
}
