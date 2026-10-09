'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

export async function markDriverOnboarded() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;

  if (role !== 'driver' || !driverId) {
    return { success: false, error: 'Не водитель' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('drivers')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', driverId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/driver');
  return { success: true };
}
