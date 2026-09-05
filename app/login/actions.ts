'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

export async function login(formData: FormData) {
  const login = formData.get('login') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();

  // Проверяем офис
  const { data: admin } = await supabase
    .from('users')
    .select('*')
    .eq('login', login)
    .eq('password', password)
    .maybeSingle();

  if (admin) {
    cookies().set('role', 'admin', { path: '/' });
    redirect('/');
  }

  // Проверяем водителя
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('last_name', login)
    .eq('password', password)
    .maybeSingle();

  if (driver) {
    cookies().set('role', 'driver', { path: '/' });
    cookies().set('driver_id', driver.id, { path: '/' });
    redirect('/driver');
  }

  redirect('/login?error=1');
}
