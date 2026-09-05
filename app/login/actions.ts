'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

export async function login(formData: FormData) {
  const login = formData.get('login') as string;
  const password = formData.get('password') as string;

  console.log('LOGIN_ACTION_START', { login, password });

  const supabase = await createClient();
  console.log('SUPABASE_CLIENT_CREATED');

  // 1. Проверяем офис
  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('*')
    .eq('login', login)
    .eq('password', password)
    .maybeSingle();

  if (adminError) {
    console.error('ADMIN_QUERY_ERROR', adminError.message);
  } else {
    console.log('ADMIN_QUERY_RESULT', admin);
  }

  if (admin) {
    console.log('ADMIN_FOUND');
    cookies().set('role', 'admin', { path: '/' });
    redirect('/');
  }

  // 2. Проверяем водителя
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('last_name', login)
    .eq('password', password)
    .maybeSingle();

  if (driverError) {
    console.error('DRIVER_QUERY_ERROR', driverError.message);
  } else {
    console.log('DRIVER_QUERY_RESULT', driver);
  }

  if (driver) {
    console.log('DRIVER_FOUND');
    cookies().set('role', 'driver', { path: '/' });
    cookies().set('driver_id', driver.id, { path: '/' });
    redirect('/driver');
  }

  console.log('NO_MATCH_FOUND');
  redirect('/login?error=1');
}
